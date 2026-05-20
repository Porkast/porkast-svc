import { eq, and, gt, desc, sql } from 'drizzle-orm'

import { SubscriptionDataDto } from "../models/subscription"
import { FeedItem, FeedItemDto } from "../models/feeds"
import { formatDateTime, generateFeedItemId } from "../utils/common"
import { searchPodcastEpisodeFromItunes } from "../utils/itunes"
import { logger } from "../utils/logger"
import { searchSpotifyEpisodes } from "../utils/spotify"
import { PODCAST_SOURCES } from "../models/types"
import { decodeDatabaseText } from "../utils/text"
import * as schema from './schema'

type DbClient = ReturnType<typeof import('./client').createDb>

export async function getAllUserSubscriptions(db: DbClient): Promise<SubscriptionDataDto[]> {
  const subscriptions = await db
    .select()
    .from(schema.userSubscription)
    .where(eq(schema.userSubscription.status, 1))

  return subscriptions.map((sub) => ({
    Id: sub.id || "",
    UserId: sub.userId || "",
    CreateTime: sub.createTime ? new Date(sub.createTime) : new Date(),
    Status: sub.status || 0,
    Keyword: sub.keyword || "",
    OrderByDate: sub.orderByDate || 0,
    Lang: sub.lang || "",
    Country: sub.country || "",
    ExcludeFeedId: sub.excludeFeedId || "",
    Source: sub.source || "",
    RefId: sub.refId || "",
    RefName: sub.refName || "",
    Type: sub.type || "",
    Count: sub.totalCount || 0,
    UpdateTime: sub.updateTime ? new Date(sub.updateTime) : undefined,
    TotalCount: sub.totalCount || 0,
  }))
}

export async function queryUserLatestKeywordSubscriptionFeedItemList(
  db: DbClient,
  userId: string,
  keyword: string,
  source: string,
  country: string,
  excludeFeedId: string,
  latestId: number,
  offset: number,
  limit: number
): Promise<FeedItem[]> {
  const queryResultList = await db
    .select({
      id: schema.feedItem.id,
      feed_id: schema.feedItem.feedId,
      guid: schema.feedItem.guid,
      channel_id: schema.feedItem.channelId,
      title: schema.feedItem.title,
      link: schema.feedItem.link,
      pub_date: schema.feedItem.pubDate,
      author: schema.feedItem.author,
      input_date: schema.feedItem.inputDate,
      image_url: schema.feedItem.imageUrl,
      enclosure_url: schema.feedItem.enclosureUrl,
      enclosure_length: schema.feedItem.enclosureLength,
      enclosure_type: schema.feedItem.enclosureType,
      description: schema.feedItem.description,
      duration: schema.feedItem.duration,
      episode: schema.feedItem.episode,
      explicit: schema.feedItem.explicit,
      season: schema.feedItem.season,
      episodetype: schema.feedItem.episodetype,
      channel_title: schema.feedItem.channelTitle,
      feed_link: schema.feedItem.feedLink,
      source: schema.keywordSubscription.source,
      exclude_feed_id: schema.keywordSubscription.excludeFeedId,
      country: schema.keywordSubscription.country,
    })
    .from(schema.feedItem)
    .innerJoin(
      schema.keywordSubscription,
      eq(schema.feedItem.id, schema.keywordSubscription.feedItemId)
    )
    .innerJoin(
      schema.userSubscription,
      and(
        eq(schema.userSubscription.keyword, schema.keywordSubscription.keyword),
        eq(schema.userSubscription.country, schema.keywordSubscription.country),
        eq(schema.userSubscription.excludeFeedId, schema.keywordSubscription.excludeFeedId),
        eq(schema.userSubscription.source, schema.keywordSubscription.source),
      )
    )
    .where(
      and(
        eq(schema.userSubscription.userId, userId),
        eq(schema.userSubscription.keyword, keyword),
        eq(schema.userSubscription.source, source),
        eq(schema.userSubscription.country, country),
        eq(schema.userSubscription.excludeFeedId, excludeFeedId),
        gt(schema.keywordSubscription.id, latestId),
        eq(schema.userSubscription.status, 1),
      )
    )
    .orderBy(desc(schema.feedItem.pubDate))
    .limit(limit)
    .offset(offset)

  const totalCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.keywordSubscription)
    .where(
      and(
        eq(schema.keywordSubscription.keyword, keyword),
        eq(schema.keywordSubscription.source, source),
        eq(schema.keywordSubscription.country, country),
        eq(schema.keywordSubscription.excludeFeedId, excludeFeedId),
      )
    )
    .then((r) => Number(r[0]?.count || 0))

  return queryResultList.map((row) => ({
    Id: row.id,
    FeedId: row.feed_id,
    GUID: row.guid || '',
    ChannelId: row.channel_id,
    Title: row.title || '',
    HighlightTitle: row.title || '',
    Link: row.link || '',
    PubDate: formatDateTime(row.pub_date?.toString() || new Date().toString()),
    Author: row.author || '',
    InputDate: row.input_date ? new Date(row.input_date) : new Date(),
    ImageUrl: row.image_url || '',
    EnclosureUrl: row.enclosure_url || '',
    EnclosureLength: row.enclosure_length || '0',
    EnclosureType: row.enclosure_type || '',
    Description: decodeDatabaseText(row.description),
    Source: row.source || '',
    Country: row.country || '',
    ExcludeFeedId: row.exclude_feed_id || '',
    Duration: row.duration || '',
    Episode: row.episode || '',
    Explicit: row.explicit || '',
    Season: row.season || '',
    EpisodeType: row.enclosure_type || '',
    TextDescription: '',
    ChannelImageUrl: '',
    ChannelTitle: row.channel_title || '',
    HighlightChannelTitle: "",
    FeedLink: row.feed_link || '',
    Count: totalCount,
    TookTime: 0,
    HasThumbnail: true,
  }))
}

export async function recoredUserKeywordSubscription(
  db: DbClient,
  userId: string,
  keyword: string,
  source: string,
  country: string,
  excludeFeedId: string,
  sortByDate: number
): Promise<string> {
  const existing = await db
    .select()
    .from(schema.userSubscription)
    .where(
      and(
        eq(schema.userSubscription.userId, userId),
        eq(schema.userSubscription.keyword, keyword),
        eq(schema.userSubscription.source, source),
        eq(schema.userSubscription.status, 1),
      )
    )
    .limit(1)

  if (existing.length > 0) {
    return 'Already subscribed'
  }

  try {
    await db.insert(schema.userSubscription).values({
      id: crypto.randomUUID(),
      userId: userId,
      keyword: keyword,
      country: country,
      source: source,
      excludeFeedId: excludeFeedId,
      orderByDate: sortByDate,
      status: 1,
      createTime: new Date().toISOString(),
      type: 'searchKeyword',
    })
  } catch (error: any) {
    if (error?.message?.includes('UNIQUE constraint failed')) {
      return 'Already subscribed'
    }
    return error?.message || 'Failed'
  }

  return ""
}

export async function doSearchSubscription(
  db: DbClient,
  keyword: string,
  country: string,
  source: string,
  excludeFeedId: string
) {
  let searchResultItemList: FeedItem[] = []
  if (source == PODCAST_SOURCES.ITUNES) {
    const searchResult = await searchPodcastEpisodeFromItunes(keyword, 'podcastEpisode', country, excludeFeedId, 0, 0, 200)
    searchResultItemList.push(...searchResult)
  } else {
    const searchResult = await searchSpotifyEpisodes(keyword, country, 50, 0)
    searchResultItemList.push(...searchResult)
  }

  const ksInsertValues: (typeof schema.keywordSubscription.$inferInsert)[] = []
  const feedItemInsertValues: (typeof schema.feedItem.$inferInsert)[] = []

  for (const item of searchResultItemList) {
    const itemId = await generateFeedItemId(item.FeedLink, item.Title)
    const channelId = await generateFeedItemId(item.FeedLink, item.ChannelTitle)

    ksInsertValues.push({
      keyword: keyword,
      feedChannelId: String(channelId),
      feedItemId: String(itemId),
      createTime: new Date().toISOString(),
      country: country,
      source: source,
      excludeFeedId: excludeFeedId,
    })

    feedItemInsertValues.push({
      id: itemId,
      feedId: String(item.FeedId),
      channelId: channelId,
      feedLink: item.FeedLink,
      channelTitle: item.ChannelTitle,
      guid: item.GUID,
      title: item.Title,
      link: item.Link,
      pubDate: new Date(item.PubDate).toISOString(),
      author: item.Author,
      inputDate: new Date().toISOString(),
      imageUrl: item.ImageUrl,
      enclosureUrl: item.EnclosureUrl,
      enclosureLength: String(item.EnclosureLength),
      enclosureType: item.EnclosureType,
      duration: item.Duration,
      episode: item.Episode,
      explicit: item.Explicit,
      season: item.Season,
      episodetype: item.EpisodeType,
      source: item.Source,
      description: new TextEncoder().encode(item.Description || ''),
    })
  }

  try {
    await db.insert(schema.keywordSubscription).values(ksInsertValues)
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE constraint failed')) {
      logger.warn('UNIQUE constraint violation for keyword_subscription, ignoring')
    } else {
      throw e
    }
  }

  try {
    await db.insert(schema.feedItem).values(feedItemInsertValues)
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE constraint failed')) {
      logger.warn('UNIQUE constraint violation for feed_item, ignoring')
    } else {
      throw e
    }
  }
}

export async function queryUserKeywordSubscriptionList(
  db: DbClient,
  userId: string,
  offset: number,
  limit: number
): Promise<SubscriptionDataDto[]> {
  const queryResultList = await db
    .select()
    .from(schema.userSubscription)
    .where(
      and(
        eq(schema.userSubscription.userId, userId),
        eq(schema.userSubscription.status, 1),
      )
    )
    .orderBy(desc(schema.userSubscription.latestId))
    .limit(limit)
    .offset(offset)

  const totalCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.userSubscription)
    .where(
      and(
        eq(schema.userSubscription.userId, userId),
        eq(schema.userSubscription.status, 1),
      )
    )
    .then((r) => Number(r[0]?.count || 0))

  return queryResultList.map((row) => ({
    Id: row.id,
    UserId: row.userId || '',
    CreateTime: row.createTime ? new Date(row.createTime) : new Date(),
    Status: row.status || 0,
    Keyword: row.keyword || '',
    OrderByDate: row.orderByDate || 0,
    Lang: row.lang || '',
    Country: row.country || '',
    ExcludeFeedId: row.excludeFeedId || '',
    Source: row.source || '',
    RefId: row.refId || '',
    RefName: row.refName || '',
    Type: row.type || '',
    Count: totalCount,
    UpdateTime: row.updateTime ? new Date(row.updateTime) : undefined,
    TotalCount: row.totalCount || 0,
  }))
}

export async function queryKeywordSubscriptionFeedItemList(
  db: DbClient,
  userId: string,
  keyword: string,
  source: string,
  country: string,
  excludeFeedId: string,
  offset: number,
  limit: number
): Promise<[FeedItem[], number]> {
  const queryResultList = await db
    .select({
      id: schema.feedItem.id,
      feed_id: schema.feedItem.feedId,
      guid: schema.feedItem.guid,
      channel_id: schema.feedItem.channelId,
      title: schema.feedItem.title,
      link: schema.feedItem.link,
      pub_date: schema.feedItem.pubDate,
      author: schema.feedItem.author,
      input_date: schema.feedItem.inputDate,
      image_url: schema.feedItem.imageUrl,
      enclosure_url: schema.feedItem.enclosureUrl,
      enclosure_length: schema.feedItem.enclosureLength,
      enclosure_type: schema.feedItem.enclosureType,
      description: schema.feedItem.description,
      duration: schema.feedItem.duration,
      episode: schema.feedItem.episode,
      explicit: schema.feedItem.explicit,
      season: schema.feedItem.season,
      episodetype: schema.feedItem.episodetype,
      channel_title: schema.feedItem.channelTitle,
      feed_link: schema.feedItem.feedLink,
      source: schema.keywordSubscription.source,
      exclude_feed_id: schema.keywordSubscription.excludeFeedId,
      country: schema.keywordSubscription.country,
    })
    .from(schema.feedItem)
    .innerJoin(
      schema.keywordSubscription,
      eq(schema.feedItem.id, schema.keywordSubscription.feedItemId)
    )
    .innerJoin(
      schema.userSubscription,
      and(
        eq(schema.userSubscription.keyword, schema.keywordSubscription.keyword),
        eq(schema.userSubscription.country, schema.keywordSubscription.country),
        eq(schema.userSubscription.excludeFeedId, schema.keywordSubscription.excludeFeedId),
        eq(schema.userSubscription.source, schema.keywordSubscription.source),
      )
    )
    .where(
      and(
        eq(schema.userSubscription.userId, userId),
        eq(schema.userSubscription.keyword, keyword),
        eq(schema.userSubscription.source, source),
        eq(schema.userSubscription.country, country),
        eq(schema.userSubscription.excludeFeedId, excludeFeedId),
        eq(schema.userSubscription.status, 1),
      )
    )
    .orderBy(desc(schema.feedItem.pubDate))
    .limit(limit)
    .offset(offset)

  const totalCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.keywordSubscription)
    .where(
      and(
        eq(schema.keywordSubscription.keyword, keyword),
        eq(schema.keywordSubscription.source, source),
        eq(schema.keywordSubscription.country, country),
        eq(schema.keywordSubscription.excludeFeedId, excludeFeedId),
      )
    )
    .then((r) => Number(r[0]?.count || 0))

  return [queryResultList.map((row) => ({
    Id: row.id,
    FeedId: row.feed_id,
    GUID: row.guid || '',
    ChannelId: row.channel_id,
    Title: row.title || '',
    HighlightTitle: row.title || '',
    Link: row.link || '',
    PubDate: formatDateTime(row.pub_date?.toString() || new Date().toString()),
    Author: row.author || '',
    InputDate: row.input_date ? new Date(row.input_date) : new Date(),
    ImageUrl: row.image_url || '',
    EnclosureUrl: row.enclosure_url || '',
    EnclosureLength: row.enclosure_length || '0',
    EnclosureType: row.enclosure_type || '',
    Description: decodeDatabaseText(row.description),
    Source: row.source || '',
    Country: row.country || '',
    ExcludeFeedId: row.exclude_feed_id || '',
    Duration: row.duration || '',
    Episode: row.episode || '',
    Explicit: row.explicit || '',
    Season: row.season || '',
    EpisodeType: row.enclosure_type || '',
    TextDescription: '',
    ChannelImageUrl: '',
    ChannelTitle: row.channel_title || '',
    HighlightChannelTitle: "",
    FeedLink: row.feed_link || '',
    Count: totalCount,
    TookTime: 0,
    HasThumbnail: true,
  })), totalCount]
}

export async function queryUserAllKeywordSubscriptionFeedItemList(
  db: DbClient,
  userId: string,
  offset: number,
  limit: number
): Promise<FeedItem[]> {
  const queryResultList = await db.all<FeedItemDto>(sql`
    WITH matched_items AS (
      SELECT
        fi.id,
        MAX(ks.create_time) AS latest_update_time,
        (SELECT ks2.exclude_feed_id FROM keyword_subscription ks2 WHERE ks2.feed_item_id = fi.id ORDER BY ks2.create_time DESC LIMIT 1) AS exclude_feed_id,
        (SELECT ks2.country FROM keyword_subscription ks2 WHERE ks2.feed_item_id = fi.id ORDER BY ks2.create_time DESC LIMIT 1) AS country
      FROM feed_item fi
      INNER JOIN keyword_subscription ks ON (fi.id = ks.feed_item_id)
      INNER JOIN user_subscription usk ON (usk.keyword = ks.keyword AND usk.country = ks.country AND usk.exclude_feed_id = ks.exclude_feed_id AND usk.source = ks.source)
      WHERE usk.user_id = ${userId} AND usk.status = 1
      GROUP BY fi.id
    )
    SELECT
      fi.*,
      matched_items.exclude_feed_id,
      matched_items.country,
      COUNT(*) OVER() AS count
    FROM feed_item fi
    INNER JOIN matched_items ON matched_items.id = fi.id
    ORDER BY fi.pub_date DESC NULLS LAST, fi.id DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `)

  return queryResultList.map((queryResult) => mapSubscriptionFeedItem(queryResult, Number(queryResult.count || 0)))
}

function mapSubscriptionFeedItem(queryResult: FeedItemDto, totalCount: number): FeedItem {
  return {
    Id: queryResult.id,
    FeedId: queryResult.feed_id,
    GUID: queryResult.guid || '',
    ChannelId: queryResult.channel_id,
    Title: queryResult.title || '',
    HighlightTitle: queryResult.title || '',
    Link: queryResult.link || '',
    PubDate: formatDateTime(queryResult.pub_date?.toString() || new Date().toString()),
    Author: queryResult.author || '',
    InputDate: queryResult.input_date ? new Date(queryResult.input_date) : new Date(),
    ImageUrl: queryResult.image_url || '',
    EnclosureUrl: queryResult.enclosure_url || '',
    EnclosureLength: queryResult.enclosure_length || '0',
    EnclosureType: queryResult.enclosure_type || '',
    Description: decodeDatabaseText(queryResult.description),
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
    HasThumbnail: true,
  }
}

export async function queryUserKeywordSubscriptionDetail(
  db: DbClient,
  userId: string,
  keyword: string
): Promise<SubscriptionDataDto> {
  const queryResult = await db
    .select()
    .from(schema.userSubscription)
    .where(
      and(
        eq(schema.userSubscription.userId, userId),
        eq(schema.userSubscription.keyword, keyword),
      )
    )
    .limit(1)

  if (queryResult.length === 0) {
    throw new Error("Subscription not found")
  }

  const row = queryResult[0]
  return {
    Id: row.id || "",
    UserId: row.userId || "",
    CreateTime: row.createTime ? new Date(row.createTime) : new Date(),
    Status: row.status || 0,
    Keyword: row.keyword || "",
    OrderByDate: row.orderByDate || 0,
    Lang: row.lang || "",
    Country: row.country || "",
    ExcludeFeedId: row.excludeFeedId || "",
    Source: row.source || "",
    RefId: row.refId || "",
    RefName: row.refName || "",
    Type: row.type || "",
    Count: 0,
  }
}

export async function disableUserKeywordSubscription(
  db: DbClient,
  userId: string,
  keyword: string
): Promise<boolean> {
  const result = await db
    .update(schema.userSubscription)
    .set({
      status: 0,
      updateTime: new Date().toISOString(),
    })
    .where(
      and(
        eq(schema.userSubscription.userId, userId),
        eq(schema.userSubscription.keyword, keyword),
        eq(schema.userSubscription.status, 1),
      )
    )

  return (result as any)?.meta?.rows_written > 0 || (result as any)?.changes > 0
}
