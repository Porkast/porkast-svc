import { eq, and, desc, sql } from 'drizzle-orm'
import { KeywordSubscribeRequestData } from "./types"
import { userSubscription, keywordSubscription } from "../../db/schema"
import { doSearchSubscription, queryUserAllKeywordSubscriptionFeedItemList, queryUserKeywordSubscriptionList } from "../../db/subscription"
import { checkKeywordLimit } from "../membership/membership"
import { logger } from "../../utils/logger"
import type { FeedItem } from "../../models/feeds"
import type { SubscriptionDataDto } from "../../models/subscription"
import type { DbClient } from '../../db/types'

export async function updateUserSubscription(db: DbClient, request: KeywordSubscribeRequestData): Promise<string> {
    const userId = request.userId
    const keyword = request.keyword
    const country = request.country
    const excludeFeedId = request.excludeFeedId || ''
    const source = request.source
    const sortByDate = request.sortByDate

    const limitCheck = await checkKeywordLimit(db, userId)
    if (!limitCheck.allowed) {
        return `Keyword subscription limit reached (${limitCheck.used}/${limitCheck.limit}). Upgrade to add more.`
    }

    const existing = await db
        .select()
        .from(userSubscription)
        .where(
            and(
                eq(userSubscription.userId, userId),
                eq(userSubscription.keyword, keyword),
                eq(userSubscription.source, source),
                eq(userSubscription.status, 1),
            )
        )
        .limit(1)

    if (existing.length > 0) {
        return 'Already subscribed'
    }

    const subId = crypto.randomUUID()

    try {
        await db.insert(userSubscription).values({
            id: subId,
            userId: userId,
            keyword: keyword,
            country: country,
            source: source,
            excludeFeedId: excludeFeedId,
            orderByDate: sortByDate,
            status: 1,
            createTime: new Date().toISOString(),
            type: 'searchKeyword',
        })
    } catch (error: any) {
        if (error?.message?.includes('UNIQUE constraint failed')) {
            return 'Already subscribed'
        }
        logger.error(String(error))
        throw error
    }

    try {
        await doSearchSubscription(db, keyword, country, source, excludeFeedId)
    } catch (error) {
        logger.error(String(error))
        return "Something went wrong, please try again later"
    }

    try {
        const [latestKs, total] = await Promise.all([
            db
                .select({ id: keywordSubscription.id, createTime: keywordSubscription.createTime })
                .from(keywordSubscription)
                .where(
                    and(
                        eq(keywordSubscription.keyword, keyword),
                        eq(keywordSubscription.source, source),
                        eq(keywordSubscription.country, country),
                        eq(keywordSubscription.excludeFeedId, excludeFeedId),
                    )
                )
                .orderBy(desc(keywordSubscription.id))
                .limit(1),

            db
                .select({ count: sql<number>`COUNT(*)` })
                .from(keywordSubscription)
                .where(
                    and(
                        eq(keywordSubscription.keyword, keyword),
                        eq(keywordSubscription.source, source),
                        eq(keywordSubscription.country, country),
                        eq(keywordSubscription.excludeFeedId, excludeFeedId),
                    )
                )
                .then(r => r[0]?.count || 0),
        ])

        if (latestKs[0]?.id) {
            await db
                .update(userSubscription)
                .set({
                    latestId: latestKs[0].id,
                    updateTime: latestKs[0].createTime,
                    totalCount: total,
                })
                .where(eq(userSubscription.id, subId))
        }
    } catch (error) {
        logger.error(String(error))
    }

    return 'done'
}

export async function getUserSubscriptionList(db: DbClient, userId: string, limit: string, offset: string): Promise<SubscriptionDataDto[]> {
    const limitInt = parseInt(limit)
    const offsetInt = parseInt(offset)
    return queryUserKeywordSubscriptionList(db, userId, offsetInt, limitInt)
}

export async function getUserSubscriptionEpisodeList(db: DbClient, userId: string, limit: string, offset: string): Promise<FeedItem[]> {
    const limitInt = parseInt(limit)
    const offsetInt = parseInt(offset)
    return queryUserAllKeywordSubscriptionFeedItemList(db, userId, offsetInt, limitInt)
}
