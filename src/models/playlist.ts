import { Userinfo } from "../api/user/types";

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
    UserInfo?: Userinfo
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