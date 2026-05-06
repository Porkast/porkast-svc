import { KeywordSubscribeRequestData } from "./types";
import prisma from "../../db/prisma.client";
import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from 'uuid';
import { FeedItem } from "../../models/feeds";
import { doSearchSubscription, queryUserAllKeywordSubscriptionFeedItemList, queryUserKeywordSubscriptionList } from "../../db/subscription";
import { SubscriptionDataDto } from "../../models/subscription";
import { logger } from "../../utils/logger";


export async function updateUserSubscription(request: KeywordSubscribeRequestData): Promise<String> {
    const userId = request.userId
    const keyword = request.keyword
    const country = request.country
    const excludeFeedId = request.excludeFeedId || ''
    const source = request.source
    const sortByDate = request.sortByDate

    const userSubscriptionRecord = await prisma.user_subscription.findFirst({
        where: {
            user_id: userId,
            keyword: keyword,
            source: source,
            status: 1,
        }
    })

    if (userSubscriptionRecord?.id) {
        return 'Already subscribed'
    }

    let userSubscription: { id: string } | null = null

    try {
        userSubscription = await prisma.user_subscription.create({
            data: {
                id: uuidv4(),
                user_id: userId,
                keyword: keyword,
                country: country,
                source: source,
                exclude_feed_id: excludeFeedId,
                order_by_date: sortByDate,
                status: 1,
                create_time: new Date(),
                type: 'searchKeyword'
            }
        })
    } catch (error) {

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code == 'P2002') {
                return 'Already subscribed'
            }
        }

        logger.error(String(error))
        throw error
    }

    try {
        await doSearchSubscription(keyword, country, source, excludeFeedId)
    } catch (error) {
        logger.error(String(error))
        return "Something went wrong, please try again later"
    }

    try {
        const [latestKs, totalCount] = await Promise.all([
            prisma.keyword_subscription.findFirst({
                where: {
                    keyword: keyword,
                    source: source,
                    country: country,
                    exclude_feed_id: excludeFeedId
                },
                orderBy: { id: 'desc' },
                select: { id: true, create_time: true }
            }),
            prisma.keyword_subscription.count({
                where: {
                    keyword: keyword,
                    source: source,
                    country: country,
                    exclude_feed_id: excludeFeedId
                }
            })
        ])

        if (latestKs?.id) {
            await prisma.user_subscription.update({
                where: { id: userSubscription!.id },
                data: {
                    latest_id: latestKs.id,
                    update_time: latestKs.create_time,
                    total_count: totalCount
                }
            })
        }
    } catch (error) {
        logger.error(String(error))
    }

    return 'done'
}

export async function getUserSubscriptionList(userId: string, limit: string, offset: string): Promise<SubscriptionDataDto[]> {
    const limitInt = parseInt(limit)
    const offsetInt = parseInt(offset)
    const resultDtos = await queryUserKeywordSubscriptionList(userId, offsetInt, limitInt)
    return resultDtos
}

export async function getUserSubscriptionEpisodeList(userId: string, limit: string, offset: string): Promise<FeedItem[]> {
    const limitInt = parseInt(limit)
    const offsetInt = parseInt(offset)
    return queryUserAllKeywordSubscriptionFeedItemList(userId, offsetInt, limitInt)
}
