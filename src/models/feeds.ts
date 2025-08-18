export type FeedItem = {
    Id: string;
    FeedId: string;
    GUID: string;
    ChannelId: string;
    Title: string;
    HighlightTitle: string;
    Link: string;
    PubDate: string;
    Author: string;
    InputDate: Date;
    ImageUrl: string;
    EnclosureUrl: string;
    EnclosureType: string;
    EnclosureLength: string;
    Duration: string;
    Episode: string;
    Explicit: string;
    Season: string;
    EpisodeType: string;
    Description: string;
    TextDescription: string;
    ChannelImageUrl: string;
    ChannelTitle: string;
    HighlightChannelTitle: string;
    FeedLink: string;
    Count: number;
    Source: string
    ExcludeFeedId: string
    Country: string
    TookTime: number;
    HasThumbnail: boolean;
}

export type FeedItemDto = {
    id: string
    channel_id: string
    guid?: string | null
    title?: string | null
    link?: string | null
    pub_date?: Date | null
    author?: string | null
    input_date?: Date | null
    image_url?: string | null
    enclosure_url?: string | null
    enclosure_type?: string | null
    enclosure_length?: string | null
    duration?: string | null
    episode?: string | null
    explicit?: string | null
    season?: string | null
    episodeType?: string | null
    description?: Buffer | null
    channel_title?: string | null
    feed_id: string
    feed_link?: string | null
    source?: string | null
    count: number;
    exclude_feed_id: string
    country: string
}

export type FeedChannel = {
    Id: string;
    Title: string;
    ChannelDesc: string;
    TextChannelDesc: string;
    ImageUrl: string;
    Link: string;
    FeedLink: string;
    FeedType: string;
    Categories: string[];
    Author: string;
    OwnerName: string;
    OwnerEmail: string;
    Items: FeedItem[];
    Count: number;
    Copyright: string;
    Language: string;
    TookTime: number;
    HasThumbnail: boolean;
}