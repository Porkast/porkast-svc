import prisma from "../db/prisma.client"
import { SubscriptionDataDto } from "../models/subscription";
import { FeedItem, FeedItemDto } from "../models/feeds";
import { Prisma } from "@prisma/client";
import { formatDateTime, generateFeedItemId } from "../utils/common";
import { searchPodcastEpisodeFromItunes } from "../utils/itunes";
import { v4 as uuidv4 } from 'uuid';
import { logger } from "../utils/logger";


export async function getAllUserSubscriptions(): Promise<SubscriptionDataDto[]> {
    const subscriptions = await prisma.user_subscription.findMany({
        where: {
            status: 1
        }
    });

    let subscriptionList: SubscriptionDataDto[] = [];

    for (const subscription of subscriptions) {
        let subscriptionData: SubscriptionDataDto = {
            Id: subscription.id || "",
            UserId: subscription.user_id || "",
            CreateTime: subscription.create_time || new Date(),
            Status: subscription.status || 0,
            Keyword: subscription.keyword || "",
            OrderByDate: subscription.order_by_date || 0,
            Lang: subscription.lang || "",
            Country: subscription.country || "",
            ExcludeFeedId: subscription.exclude_feed_id || "",
            Source: subscription.source || "",
            RefId: subscription.ref_id || "",
            RefName: subscription.ref_name || "",
            Type: subscription.type || "",
            Count: subscription.total_count || 0,
            UpdateTime: subscription.update_time,
            TotalCount: subscription.total_count || 0
        };
        subscriptionList.push(subscriptionData);
    }

    return subscriptionList
}

export async function queryUserLatestKeywordSubscriptionFeedItemList(userId: string, keyword: string, source: string, country: string, excludeFeedId: string, latestId: number, offset: number, limit: number): Promise<FeedItem[]> {
    const resultList: FeedItem[] = []

    const queryResultList = await prisma.$queryRaw<FeedItemDto[]>(
        Prisma.sql`
        SELECT fi.*,ks.source,ks.exclude_feed_id,ks.country 
        FROM feed_item fi 
        INNER JOIN keyword_subscription ks ON (fi.id = ks.feed_item_id) 
        INNER JOIN user_subscription usk ON (usk.keyword = ks.keyword and usk.country = ks.country and usk.exclude_feed_id = ks.exclude_feed_id and usk.source = ks.source) 
        WHERE usk.user_id = ${userId} and usk.keyword = ${keyword} and usk.source = ${source} and usk.country = ${country} and usk.exclude_feed_id = ${excludeFeedId} and ks.id > ${latestId} and usk.status = 1 
        ORDER BY fi.pub_date DESC 
        LIMIT ${limit}
        OFFSET ${offset}
        `
    )

    const totalCount = await prisma.keyword_subscription.count({
        where: {
            keyword: keyword,
            source: source,
            country: country,
            exclude_feed_id: excludeFeedId,
        }
    })

    for (const queryResult of queryResultList) {
        resultList.push({
            Id: queryResult.id,
            FeedId: queryResult.feed_id,
            GUID: queryResult.guid || '',
            ChannelId: queryResult.channel_id,
            Title: queryResult.title || '',
            HighlightTitle: queryResult.title || '',
            Link: queryResult.link || '',
            PubDate: formatDateTime(queryResult.pub_date?.toString() || new Date().toString()),
            Author: queryResult.author || '',
            InputDate: queryResult.input_date || new Date(),
            ImageUrl: queryResult.image_url || '',
            EnclosureUrl: queryResult.enclosure_url || '',
            EnclosureLength: queryResult.enclosure_length || '0',
            EnclosureType: queryResult.enclosure_type || '',
            Description: String(queryResult.description) || '',
            Source: queryResult.source || '',
            Country: queryResult.country || '',
            ExcludeFeedId: queryResult.exclude_feed_id || '',
            Duration: queryResult.duration || '',
            Episode: queryResult.episode || '',
            Explicit: queryResult.explicit || '',
            Season: queryResult.season || '',
            EpisodeType: queryResult.enclosure_type || '',
            TextDescription: '',
            ChannelImageUrl: '',
            ChannelTitle: queryResult.channel_title || '',
            HighlightChannelTitle: "",
            FeedLink: queryResult.feed_link || '',
            Count: totalCount,
            TookTime: 0,
            HasThumbnail: true
        })
    }

    return resultList
}

export async function recoredUserKeywordSubscription(userId: string, keyword: string, source: string, country: string, excludeFeedId: string, sortByDate: number): Promise<string> {
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
            return error.message
        }

        return 'Failed'
    }

    return ""
}

export async function doSearchSubscription(keyword: string, country: string, source: string, excludeFeedId: string) {
    let searchResultItemList: FeedItem[] = [];
    if (source == 'itunes' || source == '') {
        const searchResult = await searchPodcastEpisodeFromItunes(keyword, 'podcastEpisode', country, excludeFeedId, 0, 0, 200)
        searchResultItemList.push(...searchResult);
    } else {
        // TODO: implement other sources
    }

    let ksManyInput: Prisma.keyword_subscriptionCreateManyInput[] = [];
    for (const item of searchResultItemList) {
        const itemId = await generateFeedItemId(item.FeedLink, item.Title)
        const channelId = await generateFeedItemId(item.FeedLink, item.ChannelTitle)
        let ksItem: Prisma.keyword_subscriptionCreateManyInput = {
            keyword: keyword,
            feed_channel_id: String(channelId),
            feed_item_id: String(itemId),
            create_time: new Date(),
            country: country,
            source: source,
            exclude_feed_id: excludeFeedId
        }

        ksManyInput.push(ksItem);
    }

    let itemManyInput: Prisma.feed_itemCreateManyInput[] = [];
    for (const item of searchResultItemList) {
        const itemId = await generateFeedItemId(item.FeedLink, item.Title)
        const channelId = await generateFeedItemId(item.FeedLink, item.ChannelTitle)
        let itemInput: Prisma.feed_itemCreateManyInput = {
            id: itemId,
            feed_id: String(item.FeedId),
            channel_id: channelId,
            feed_link: item.FeedLink,
            channel_title: item.ChannelTitle,
            guid: item.GUID,
            title: item.Title,
            link: item.Link,
            pub_date: new Date(item.PubDate),
            author: item.Author,
            input_date: new Date(),
            image_url: item.ImageUrl,
            enclosure_url: item.EnclosureUrl,
            enclosure_length: String(item.EnclosureLength),
            enclosure_type: item.EnclosureType,
            duration: item.Duration,
            episode: item.Episode,
            explicit: item.Explicit,
            season: item.Season,
            episodetype: item.EpisodeType,
            source: item.Source,
            description: item.Description,
        }

        itemManyInput.push(itemInput);
    }


    try {
        await prisma.keyword_subscription.createMany({
            data: ksManyInput,
            skipDuplicates: true
        })
    } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === 'P2002') {
                logger.warn(
                    'There is a unique constraint violation, a new record cannot be created with prisma for keyword_subscription, ignore it',
                )
            }
        } else {
            throw e
        }
    }
    try {
        await prisma.feed_item.createMany({
            data: itemManyInput,
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
            throw e
        }
    }

}

export async function queryUserKeywordSubscriptionList(userId: string, offset: number, limit: number): Promise<SubscriptionDataDto[]> {

    const resultDtos: SubscriptionDataDto[] = []

    const queryResutlList = await prisma.user_subscription.findMany({
        where: {
            user_id: userId,
            status: 1
        },
        orderBy: {
            latest_id: 'desc'
        },
        skip: offset,
        take: limit
    })

    const totalCount = await prisma.user_subscription.count({
        where: {
            user_id: userId,
            status: 1
        }
    })

    for (const queryResutl of queryResutlList) {
        resultDtos.push({
            Id: queryResutl.id,
            UserId: queryResutl.user_id || '',
            CreateTime: queryResutl.create_time || new Date(),
            Status: queryResutl.status || 0,
            Keyword: queryResutl.keyword || '',
            OrderByDate: queryResutl.order_by_date || 0,
            Lang: queryResutl.lang || '',
            Country: queryResutl.country || '',
            ExcludeFeedId: queryResutl.exclude_feed_id || '',
            Source: queryResutl.source || '',
            RefId: queryResutl.ref_id || '',
            RefName: queryResutl.ref_name || '',
            Type: queryResutl.type || '',
            Count: totalCount,
            UpdateTime: queryResutl.update_time,
            TotalCount: queryResutl.total_count || 0
        })
    }

    return resultDtos
}

export async function queryKeywordSubscriptionFeedItemList(userId: string, keyword: string, source: string, country: string, excludeFeedId: string, offset: number, limit: number): Promise<[FeedItem[], number]> {

    const resultList: FeedItem[] = []


    const queryResultList = await prisma.$queryRaw<FeedItemDto[]>(
        Prisma.sql`
        SELECT fi.*,ks.source,ks.exclude_feed_id,ks.country 
        FROM feed_item fi 
        INNER JOIN keyword_subscription ks ON (fi.id = ks.feed_item_id) 
        INNER JOIN user_subscription usk ON (usk.keyword = ks.keyword and usk.country = ks.country and usk.exclude_feed_id = ks.exclude_feed_id and usk.source = ks.source) 
        WHERE usk.user_id = ${userId} and usk.keyword = ${keyword} and usk.source = ${source} and usk.country = ${country} and usk.exclude_feed_id = ${excludeFeedId} and usk.status = 1 
        ORDER BY fi.pub_date DESC 
        LIMIT ${limit}
        OFFSET ${offset}
        `
    )

    const totalCount = await prisma.keyword_subscription.count({
        where: {
            keyword: keyword,
            source: source,
            country: country,
            exclude_feed_id: excludeFeedId,
        }
    })

    for (const queryResult of queryResultList) {
        resultList.push({
            Id: queryResult.id,
            FeedId: queryResult.feed_id,
            GUID: queryResult.guid || '',
            ChannelId: queryResult.channel_id,
            Title: queryResult.title || '',
            HighlightTitle: queryResult.title || '',
            Link: queryResult.link || '',
            PubDate: formatDateTime(queryResult.pub_date?.toString() || new Date().toString()),
            Author: queryResult.author || '',
            InputDate: queryResult.input_date || new Date(),
            ImageUrl: queryResult.image_url || '',
            EnclosureUrl: queryResult.enclosure_url || '',
            EnclosureLength: queryResult.enclosure_length || '0',
            EnclosureType: queryResult.enclosure_type || '',
            Description: String(queryResult.description) || '',
            Source: queryResult.source || '',
            Country: queryResult.country || '',
            ExcludeFeedId: queryResult.exclude_feed_id || '',
            Duration: queryResult.duration || '',
            Episode: queryResult.episode || '',
            Explicit: queryResult.explicit || '',
            Season: queryResult.season || '',
            EpisodeType: queryResult.enclosure_type || '',
            TextDescription: '',
            ChannelImageUrl: '',
            ChannelTitle: queryResult.channel_title || '',
            HighlightChannelTitle: "",
            FeedLink: queryResult.feed_link || '',
            Count: totalCount,
            TookTime: 0,
            HasThumbnail: true
        })
    }

    return [resultList, totalCount]
}


export async function queryUserKeywordSubscriptionDetail(userId: string, keyword: string): Promise<SubscriptionDataDto> {

    const queryResult = await prisma.user_subscription.findFirst({
        where: {
            user_id: userId,
            keyword: keyword
        }
    })

    if (!queryResult) {
        throw new Error("Subscription not found")
    }

    const resultDto: SubscriptionDataDto = {
        Id: queryResult?.id || "",
        UserId: queryResult?.user_id || "",
        CreateTime: queryResult?.create_time || new Date(),
        Status: queryResult?.status || 0,
        Keyword: queryResult?.keyword || "",
        OrderByDate: queryResult?.order_by_date || 0,
        Lang: queryResult?.lang || "",
        Country: queryResult?.country || "",
        ExcludeFeedId: queryResult?.exclude_feed_id || "",
        Source: queryResult?.source || "",
        RefId: queryResult?.ref_id || "",
        RefName: queryResult?.ref_name || "",
        Type: queryResult?.type || "",
        Count: 0
    }

    return resultDto
}