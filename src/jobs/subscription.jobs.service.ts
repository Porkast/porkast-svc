import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { getNickname } from "libs/common";
import { buildFeedItemAndKeywordInputList, searchPodcastEpisodeFromItunes } from "libs/itunes";
import { DBService } from "src/db/db.service";
import { PKPrismaClient } from "src/db/prisma.client";
import { EmailService } from "src/email/email.service";
import { NotificationParams } from "src/models/subscription";


@Injectable()
export class SubscriptionJobsService {

    constructor(
        private readonly dbService: DBService,
        private readonly prisma: PKPrismaClient,
        private readonly emailService: EmailService
    ) { }

    private readonly logger = new Logger(SubscriptionJobsService.name);

    // cron job run every 3 hours
    @Cron('0 */3 * * * *')
    async updateUserSubscription() {
        this.logger.log('The subscription job has been run');
        const allUserSubs = await this.dbService.getAllUserSubscriptions();
        for (const sub of allUserSubs) {
            const keyword = sub.Keyword
            const country = sub.Country
            const excludeFeedIds = sub.ExcludeFeedId
            const source = sub.Source
            const feedItemList = await searchPodcastEpisodeFromItunes(keyword, 'podcastEpisode', country, excludeFeedIds, 0, 0, 200)

            if (!feedItemList || feedItemList.length === 0) {
                const errMsg = 'No results from itunes, with parameters \n' + JSON.stringify({ keyword, country, excludeFeedIds, source })
                this.logger.error(errMsg)
                continue
            }

            const model = await buildFeedItemAndKeywordInputList(keyword, country, excludeFeedIds, source, feedItemList)

            try {
                await this.prisma.keyword_subscription.createMany({
                    data: model.keywordSubscriptionList,
                    skipDuplicates: true
                })
            } catch (error) {
                this.logger.error(error)
            }

            try {
                await this.prisma.feed_item.createMany({
                    data: model.feedItemList,
                    skipDuplicates: true
                })
            } catch (e) {
                if (e instanceof Prisma.PrismaClientKnownRequestError) {
                    if (e.code === 'P2002') {
                        console.log(
                            'There is a unique constraint violation, a new record cannot be created with prisma for feed_item, ignore it',
                        )
                    }
                } else {
                    const errMsg = 'Insert search feed item list failed ' + e
                    this.logger.error(errMsg)
                    continue
                }
            }

            try {
                await this.updateUserSubscriptionInfo(keyword, country, excludeFeedIds, source, sub.UserId)
            } catch (error) {
                const errMsg = 'Notify user subscription updated with keyword: ' + keyword + ' ,country: ' + country + ' ,excludeFeedIds: ' + excludeFeedIds + ' ,source: ' + source + ' ,userId: ' + sub.UserId + ' failed: ' + error
                this.logger.error(errMsg)
            }

        }
    }

    async updateUserSubscriptionInfo(keyword: string, country: string, excludeFeedIds: string, source: string, userId: string) {
        const [usEnrity, userInfo] = await Promise.all([
            this.prisma.user_subscription.findFirst({
                where: {
                    keyword: keyword,
                    country: country,
                    exclude_feed_id: excludeFeedIds,
                    source: source,
                    user_id: userId
                }
            }),

            this.prisma.user_info.findFirst({
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

        const ksList = await this.dbService.queryUserLatestKeywordSubscriptionFeedItemList(userInfo.id, keyword, source, country, excludeFeedIds, String(usEnrity.latest_id), 0, 10)
        const totalCount = await this.prisma.keyword_subscription.count({
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
            try {

                const sendNotificationEmail = async (latestId: number) => {
                    if (latestId != 0) {
                        await this.emailService.sendSubscriptionUpdateEmail(emailParams)
                    }
                }

                const [_, latestItem, totalCount] = await Promise.all([
                    sendNotificationEmail(usEnrity.latest_id || 0),
                    this.prisma.keyword_subscription.findFirst({
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
                    this.prisma.keyword_subscription.count({
                        where: {
                            keyword: keyword,
                            source: source,
                            country: country,
                            exclude_feed_id: excludeFeedIds
                        }
                    })

                ])

                if (latestItem?.id != 0) {
                    await this.prisma.user_subscription.update({
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
                this.logger.error('Failed to send subscription update email to ' + userEmail, " with params " + JSON.stringify(emailParams))
            }

        }
    }

}
