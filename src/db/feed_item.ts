import { Prisma } from "@prisma/client";
import { FeedItem } from "../models/feeds";
import prisma from "./prisma.client";


export async function createOrUpdateFeedItem(feedItem: FeedItem) {

    const queryData = await prisma.feed_item.findUnique({
        where: {
            id: feedItem.Id
        }
    })


    if (queryData) {
        let itemInfoUpdate: Prisma.feed_itemCreateInput;
        itemInfoUpdate = {
            id: feedItem.Id,
            feed_id: String(feedItem.FeedId),
            channel_id: feedItem.ChannelId,
            feed_link: feedItem.FeedLink,
            channel_title: feedItem.ChannelTitle,
            guid: feedItem.GUID,
            title: feedItem.Title,
            link: feedItem.Link,
            pub_date: new Date(feedItem.PubDate),
            author: feedItem.Author,
            image_url: feedItem.ImageUrl,
            enclosure_url: feedItem.EnclosureUrl,
            enclosure_length: String(feedItem.EnclosureLength),
            enclosure_type: feedItem.EnclosureType,
            duration: feedItem.Duration,
            episode: feedItem.Episode,
            explicit: feedItem.Explicit,
            season: feedItem.Season,
            episodetype: feedItem.EpisodeType,
            source: feedItem.Source,
            description: feedItem.Description,
        }
        await prisma.feed_item.update({
            where: {
                id: feedItem.Id
            },
            data: itemInfoUpdate
        })
    } else {
        let itemInfoCreate: Prisma.feed_itemCreateInput;
        itemInfoCreate = {
            id: feedItem.Id,
            feed_id: String(feedItem.FeedId),
            channel_id: feedItem.ChannelId,
            feed_link: feedItem.FeedLink,
            channel_title: feedItem.ChannelTitle,
            guid: feedItem.GUID,
            title: feedItem.Title,
            link: feedItem.Link,
            pub_date: new Date(feedItem.PubDate),
            author: feedItem.Author,
            input_date: new Date(),
            image_url: feedItem.ImageUrl,
            enclosure_url: feedItem.EnclosureUrl,
            enclosure_length: String(feedItem.EnclosureLength),
            enclosure_type: feedItem.EnclosureType,
            duration: feedItem.Duration,
            episode: feedItem.Episode,
            explicit: feedItem.Explicit,
            season: feedItem.Season,
            episodetype: feedItem.EpisodeType,
        }
        await prisma.feed_item.create({
            data: itemInfoCreate
        })
    }
}