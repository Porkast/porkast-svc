
export type SubscriptionDataDto = {
    Id: string;
    UserId: string;
    CreateTime: Date;
    Status: number;
    Keyword: string;
    OrderByDate: number;
    Lang: string;
    Country: string;
    ExcludeFeedId: string;
    Source: string;
    RefId: string;
    RefName: string;
    Type: string;
    Count: number;
    UpdateTime?: Date | null;
    TotalCount?: number;
}

export type NotificationParams = {
    to: string
    subject: string
    keyword: string
    nickname: string
    updateCount: number
    titleList: string[]
    link: string
}

export type KeywordUpdateItem = {
    keyword: string
    updateCount: number
    titleList: string[]
    link: string
    subscriptionId: string
    latestKsId: number
    latestKsCreateTime?: string | null
    totalCount: number
    miniAppLink?: string
    feedItems?: import('./feeds').FeedItem[]
}

export type AggregatedNotificationParams = {
    to: string
    subject?: string
    nickname: string
    totalUpdateCount: number
    keywordUpdates: KeywordUpdateItem[]
}