import prisma from "../db/prisma.client"
import { getAllUserSubscriptions, queryUserLatestKeywordSubscriptionFeedItemList } from "../db/subscription"
import { buildFeedItemAndKeywordInputList, searchPodcastEpisodeFromItunes } from "../utils/itunes";
import { Prisma } from "@prisma/client";
import { NotificationParams } from "../models/subscription";
import { getNickname } from "../utils/common";
import { sendSubscriptionUpdateEmail } from "../email/resend"
import { sendSubscriptionNewUpdateMessage } from "../telegram/bot";
import { logger } from "../utils/logger";

export async function updateUserSubscription() {
    const allUserSubs = await getAllUserSubscriptions();
    const updatePromises = allUserSubs.map(async (sub) => {
        logger.debug('Update user subscription for user: ' + sub.UserId + ' ,keyword: ' + sub.Keyword + ' ,country: ' + sub.Country + ' ,excludeFeedIds: ' + sub.ExcludeFeedId + ' ,source: ' + sub.Source)
        const keyword = sub.Keyword
        const country = sub.Country
        const excludeFeedIds = sub.ExcludeFeedId
        const source = sub.Source
        const feedItemList = await searchPodcastEpisodeFromItunes(keyword, 'podcastEpisode', country, excludeFeedIds, 0, 0, 200)

        if (!feedItemList || feedItemList.length === 0) {
            const errMsg = 'No results from itunes, with parameters \n' + JSON.stringify({ keyword, country, excludeFeedIds, source })
            logger.debug(errMsg)
            return
        }

        const model = await buildFeedItemAndKeywordInputList(keyword, country, excludeFeedIds, source, feedItemList)

        try {
            await prisma.keyword_subscription.createMany({
                data: model.keywordSubscriptionList,
                skipDuplicates: true
            })
        } catch (error) {
            logger.error('Insert keyword subscription list failed', error)
        }

        try {
            await prisma.feed_item.createMany({
                data: model.feedItemList,
                skipDuplicates: true
            })
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError) {
                if (e.code === 'P2002') {
                    logger.warn(
                        'There is a unique constraint violation, a new record cannot be created with prisma for feed_item, ignore it',
                    )
                }
            } else {
                const errMsg = 'Insert search feed item list failed ' + e
                logger.error(errMsg)
                return
            }
        }

        try {
            await updateUserSubscriptionInfo(keyword, country, excludeFeedIds, source, sub.UserId)
        } catch (error) {
            const errMsg = 'Notify user subscription updated with keyword: ' + keyword + ' ,country: ' + country + ' ,excludeFeedIds: ' + excludeFeedIds + ' ,source: ' + source + ' ,userId: ' + sub.UserId + ' failed: ' + error
            logger.error(errMsg)
        }
    })
    try {
        await Promise.all(updatePromises)
        logger.debug('Update user subscription finished')
    } catch (error) {
        logger.error('Update user subscription failed: ', error)
    }
}


async function updateUserSubscriptionInfo(keyword: string, country: string, excludeFeedIds: string, source: string, userId: string) {
    const [usEnrity, userInfo] = await Promise.all([
        prisma.user_subscription.findFirst({
            where: {
                keyword: keyword,
                country: country,
                exclude_feed_id: excludeFeedIds,
                source: source,
                user_id: userId
            }
        }),

        prisma.user_info.findFirst({
            where: {
                id: userId
            }
        })
    ])

    if (!usEnrity) {
        const errMsg = 'User subscription not found'
        throw new Error(errMsg)
    }

    if (!userInfo) {
        const errMsg = 'User info not found'
        throw new Error(errMsg)
    }

    const ksList = await queryUserLatestKeywordSubscriptionFeedItemList(
        userInfo.id,
        keyword,
        source,
        country,
        excludeFeedIds,
        usEnrity.latest_id || 0,
        0,
        10
    )
    const totalCount = await prisma.keyword_subscription.count({
        where: {
            keyword: keyword,
            source: source,
            country: country,
            exclude_feed_id: excludeFeedIds,
            id: {
                gt: usEnrity.latest_id || 0
            }
        }
    })

    const userEmail = userInfo.email
    if (totalCount > 0 && ksList && ksList.length > 0 && userEmail) {
        logger.debug(`User ${userInfo.id} subscription ${keyword} has ${totalCount} new podcast update`)
        const link = `https://porkast.com/subscription/${userInfo.id}/${keyword}`
        const emailParams: NotificationParams = {
            keyword: keyword,
            nickname: getNickname(userEmail, userInfo.nickname || ''),
            updateCount: totalCount,
            titleList: ksList.map(ks => ks.Title),
            link: link,
            to: userEmail,
            subject: "#" + keyword + " has new podcasts update"
        }
        if (userInfo.telegram_id !== null && userInfo.telegram_id !== undefined && userInfo.telegram_id !== '') {
            sendSubscriptionNewUpdateMessage(userInfo.telegram_id, keyword, totalCount, ksList, link)
        }
        try {
            const sendNotificationEmail = async (latestId: number) => {
                if (latestId != 0) {
                    try {
                        await sendSubscriptionUpdateEmail(emailParams)
                    } catch (error) {
                        logger.error('Send subscription update email failed', error)
                    }
                }
            }
            const [_, latestItem, totalCount] = await Promise.all([
                sendNotificationEmail(usEnrity.latest_id || 0),
                prisma.keyword_subscription.findFirst({
                    where: {
                        keyword: keyword,
                        source: source,
                        country: country,
                        exclude_feed_id: excludeFeedIds
                    },
                    orderBy: {
                        id: 'desc'
                    },
                    skip: 0,
                    take: 1
                }),
                prisma.keyword_subscription.count({
                    where: {
                        keyword: keyword,
                        source: source,
                        country: country,
                        exclude_feed_id: excludeFeedIds
                    }
                })

            ])

            if (latestItem?.id != 0) {
                await prisma.user_subscription.update({
                    where: {
                        id: usEnrity.id
                    },
                    data: {
                        latest_id: latestItem?.id,
                        update_time: latestItem?.create_time,
                        total_count: totalCount
                    }
                })
            }
        } catch (error) {
            logger.error('Failed to send subscription update email to ' + userEmail, " with params " + JSON.stringify(emailParams))
        }

    }
}