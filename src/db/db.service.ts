import { Injectable } from "@nestjs/common";
import { PKPrismaClient } from "./prisma.client";
import { SubscriptionDataDto } from "../models/subscription";
import { FeedItem, FeedItemDto } from "../models/feed";
import { Prisma } from "@prisma/client";
import { formatDateTime } from "../utils/common";


@Injectable()
export class DBService {

    constructor(
        private readonly prisma: PKPrismaClient
    ) { }


    async getAllUserSubscriptions(): Promise<SubscriptionDataDto[]> {
        const subscriptions = await this.prisma.user_subscription.findMany({
            where: {
                status: 1
            }
        });

        let subscriptionList: SubscriptionDataDto[] = [];

        for (const subscription of subscriptions) {
            let subscriptionData: SubscriptionDataDto = {
                Id: subscription.id,
                UserId: subscription.user_id,
                CreateTime: subscription.create_time,
                Status: subscription.status,
                Keyword: subscription.keyword,
                OrderByDate: subscription.order_by_date,
                Lang: subscription.lang,
                Country: subscription.country,
                ExcludeFeedId: subscription.exclude_feed_id,
                Source: subscription.source,
                RefId: subscription.ref_id,
                RefName: subscription.ref_name,
                Type: subscription.type,
                Count: subscription.total_count,
                UpdateTime: subscription.update_time,
                TotalCount: subscription.total_count
            };
            subscriptionList.push(subscriptionData);
        }

        return subscriptionList
    }

    async queryUserLatestKeywordSubscriptionFeedItemList(userId: string, keyword: string, source: string, country: string, excludeFeedId: string, latestId: number, offset: number, limit: number): Promise<FeedItem[]> {
        const resultList: FeedItem[] = []

        const queryResultList = await this.prisma.$queryRaw<FeedItemDto[]>(
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

        const totalCount = await this.prisma.keyword_subscription.count({
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
}