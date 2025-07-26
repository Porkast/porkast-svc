import { Prisma } from "@prisma/client"
import { FeedItem } from "../models/feeds"
import { convertMillsTimeToDuration, generateFeedItemId } from "./common"
import { iTunesResponse } from "../models/itunes"



export const searchPodcastEpisodeFromItunes = async (q: string, entity: string, country: string, excludeFeedId: string, offset: number, limit: number, totalCount: number): Promise<FeedItem[]> => {
    const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=${entity}&media=podcast&country=${country}&limit=${totalCount}`)

    const jsonResp = await res.json() as iTunesResponse;
    var items: FeedItem[] = []
    let excludeFeedIdList: string[] = []
    if (excludeFeedId) {
        excludeFeedIdList = excludeFeedId.split(',')
    }
    for (const resultItem of jsonResp.results) {
        // if the resultItem.collectionId is in excludeFeedIdList, skip
        if (excludeFeedIdList.includes(String(resultItem.collectionId))) {
            continue
        }

        // format pubdate as yy:mm:dd
        const formatedPubDate = new Date(resultItem.releaseDate).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

        const duration = convertMillsTimeToDuration(resultItem.trackTimeMillis)
        items.push({
            Id: resultItem.episodeGuid,
            ChannelId: resultItem.collectionId,
            Title: resultItem.trackName,
            HighlightTitle: resultItem.trackName,
            Link: resultItem.trackViewUrl,
            PubDate: formatedPubDate,
            Author: resultItem.artistIds.map(id => String(id)).join(', '),
            InputDate: new Date(formatedPubDate),
            ImageUrl: resultItem.artworkUrl160,
            EnclosureUrl: resultItem.episodeUrl,
            EnclosureType: resultItem.episodeFileExtension,
            EnclosureLength: String(resultItem.trackTimeMillis),
            Duration: duration,
            Episode: "",
            Explicit: "",
            Season: "",
            EpisodeType: "",
            Description: resultItem.description,
            TextDescription: resultItem.description,
            ChannelImageUrl: resultItem.artworkUrl600,
            ChannelTitle: resultItem.collectionName,
            HighlightChannelTitle: resultItem.collectionName,
            FeedLink: resultItem.feedUrl,
            Count: 0,
            TookTime: 0,
            HasThumbnail: false,
            FeedId: resultItem.collectionId,
            GUID: resultItem.episodeGuid,
            Source: "itunes",
            ExcludeFeedId: "",
            Country: country
        })
    }

    items.map(item => {
        item.Count = items.length
    })

    // order by pubDate desc
    items.sort((a, b) => {
        return new Date(b.PubDate).getTime() - new Date(a.PubDate).getTime()
    })

    if (limit == 0) {
        return items
    }

    return items.slice(offset, offset + limit)
}

export const buildFeedItemAndKeywordInputList = async (keyword: string, country: string, excludeFeedIds: string, source: string, feedItemList: FeedItem[]): Promise<{ feedItemList: Prisma.feed_itemCreateManyInput[], keywordSubscriptionList: Prisma.keyword_subscriptionCreateManyInput[] }> => {
    const feedItemCreateInputList: Prisma.feed_itemCreateManyInput[] = []
    const keywordSubscriptionInputList: Prisma.keyword_subscriptionCreateManyInput[] = []


    for (const item of feedItemList) {
        const itemId = await generateFeedItemId(item.FeedLink, item.Title)
        const channelId = await generateFeedItemId(item.FeedLink, item.ChannelTitle)
        const feedItemInput: Prisma.feed_itemCreateManyInput = {
            id: itemId,
            channel_id: channelId,
            feed_id: String(item.FeedId),
            guid: item.GUID,
            title: item.Title,
            link: item.Link,
            pub_date: new Date(item.PubDate),
            author: item.Author,
            input_date: new Date(),
            image_url: item.ImageUrl,
            enclosure_url: item.EnclosureUrl,
            enclosure_type: item.EnclosureType,
            enclosure_length: String(item.EnclosureLength),
            duration: item.Duration,
            episode: item.Episode,
            episodetype: item.EpisodeType,
            explicit: item.Explicit,
            season: item.Season,
            description: item.Description,
            channel_title: item.ChannelTitle,
            feed_link: item.FeedLink,
            source: item.Source,
        }

        const keywordSubscriptionInput: Prisma.keyword_subscriptionCreateInput = {
            keyword: keyword,
            feed_channel_id: channelId,
            feed_item_id: itemId,
            create_time: new Date(),
            country: country,
            source: source,
            exclude_feed_id: excludeFeedIds
        }

        feedItemCreateInputList.push(feedItemInput)
        keywordSubscriptionInputList.push(keywordSubscriptionInput)
    }
    return {
        feedItemList: feedItemCreateInputList,
        keywordSubscriptionList: keywordSubscriptionInputList
    }
}