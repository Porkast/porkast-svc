import { UserInfo } from "../api/user/types";

export type UserPlaylistEntity = {
    id: string
    playlist_name: string | ''
    description: Buffer | ''
    user_id: string | ''
    reg_date: Date | null
    status: number | 0
    creator_id: string | ''
    orig_playlist_id: string | ''
    count: string | '0'
}

export type UserPLaylistItemEntity = {
    id: string
    channel_id: string
    guid: string | null
    title: string | null
    link?: string | null
    pub_date?: Date | string | null
    author?: string | null
    input_date?: Date | string | null
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
    feed_link: string | null
    source?: string | null
    country?: string | null
    reg_date?: Date | string | null
    status?: number | 0
    playlist_id?: string | ''
}

export type UserPlaylistDto = {
    Id: string;
    PlaylistName: string;
    Description: string;
    UserId: string;
    RegDate: Date;
    Status: number;
    CreatorId: string;
    OrigPlaylistId?: string;
    Count: number;
    UserInfo?: UserInfo
}

export type UserPlaylistItemDto = {
    Id: string;
    FeedId: string;
    GUID: string;
    ChannelId: string;
    Title: string;
    HighlightTitle: string;
    Link: string;
    PubDate: string;
    Author: string;
    InputDate: string;
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
    RegDate: string;
    Status: number;
    PlaylistId: string;
}