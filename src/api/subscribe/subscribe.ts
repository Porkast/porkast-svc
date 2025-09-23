import { KeywordSubscribeRequestData } from "./types";
import prisma from "../../db/prisma.client";
import { Prisma } from "@prisma/client";
import { v4 as uuidv4 } from 'uuid';
import { doSearchSubscription, queryUserKeywordSubscriptionList } from "../../db/subscription";
import { SubscriptionDataDto } from "../../models/subscription";


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

    try {
        await prisma.user_subscription.create({
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

        logger.error(error)
        throw error
    }

    try {
        await doSearchSubscription(keyword, country, source, excludeFeedId)
    } catch (error) {
        logger.error(error)
        return "Something went wrong, please try again later"
    }

    return 'done'
}

export async function getUserSubscriptionList(userId: string, limit: string, offset: string): Promise<SubscriptionDataDto[]> {
    const limitInt = parseInt(limit)
    const offsetInt = parseInt(offset)
    const resultDtos = await queryUserKeywordSubscriptionList(userId, offsetInt, limitInt)
    return resultDtos
}