import { FeedItem, FeedItemDto } from "../models/feeds";
import { formatDateTime } from "./common";
import { decodeDatabaseText } from "./text";

export function mapFeedItemDtoToFeedItem(feedItem: FeedItemDto): FeedItem {
    const description = decodeDatabaseText(feedItem.description);

    return {
        Id: feedItem.id,
        FeedId: feedItem.feed_id,
        GUID: feedItem.guid || feedItem.id,
        ChannelId: feedItem.channel_id,
        Title: feedItem.title || '',
        HighlightTitle: feedItem.title || '',
        Link: feedItem.link || '',
        PubDate: formatDateTime(feedItem.pub_date?.toString() || new Date().toString()),
        Author: feedItem.author || '',
        InputDate: feedItem.input_date || new Date(),
        ImageUrl: feedItem.image_url || '',
        EnclosureUrl: feedItem.enclosure_url || '',
        EnclosureType: feedItem.enclosure_type || '',
        EnclosureLength: feedItem.enclosure_length || '',
        Duration: feedItem.duration || '',
        Episode: feedItem.episode || '',
        Explicit: feedItem.explicit || '',
        Season: feedItem.season || '',
        EpisodeType: feedItem.episodeType || '',
        Description: description,
        TextDescription: description,
        ChannelImageUrl: '',
        ChannelTitle: feedItem.channel_title || '',
        HighlightChannelTitle: '',
        FeedLink: feedItem.feed_link || '',
        Count: feedItem.count || 0,
        Source: feedItem.source || '',
        ExcludeFeedId: feedItem.exclude_feed_id || '',
        Country: feedItem.country || '',
        TookTime: 0,
        HasThumbnail: true,
    };
}
