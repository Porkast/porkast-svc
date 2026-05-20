import { eq, or } from 'drizzle-orm'
import { FeedItem, FeedItemDto } from "../models/feeds"
import { mapFeedItemDtoToFeedItem } from "../utils/feed_item"
import * as schema from './schema'

type DbClient = ReturnType<typeof import('./client').createDb>

export async function createOrUpdateFeedItem(db: DbClient, feedItem: FeedItem) {
  const existing = await db
    .select()
    .from(schema.feedItem)
    .where(eq(schema.feedItem.id, feedItem.Id))
    .limit(1)

  const descriptionBuffer = new TextEncoder().encode(feedItem.Description || '')

  if (existing.length > 0) {
    await db
      .update(schema.feedItem)
      .set({
        feedId: String(feedItem.FeedId),
        channelId: feedItem.ChannelId,
        feedLink: feedItem.FeedLink,
        channelTitle: feedItem.ChannelTitle,
        guid: feedItem.GUID,
        title: feedItem.Title,
        link: feedItem.Link,
        pubDate: new Date(feedItem.PubDate).toISOString(),
        author: feedItem.Author,
        imageUrl: feedItem.ImageUrl,
        enclosureUrl: feedItem.EnclosureUrl,
        enclosureLength: String(feedItem.EnclosureLength),
        enclosureType: feedItem.EnclosureType,
        duration: feedItem.Duration,
        episode: feedItem.Episode,
        explicit: feedItem.Explicit,
        season: feedItem.Season,
        episodetype: feedItem.EpisodeType,
        source: feedItem.Source,
        description: descriptionBuffer,
      })
      .where(eq(schema.feedItem.id, feedItem.Id))
  } else {
    await db.insert(schema.feedItem).values({
      id: feedItem.Id,
      feedId: String(feedItem.FeedId),
      channelId: feedItem.ChannelId,
      feedLink: feedItem.FeedLink,
      channelTitle: feedItem.ChannelTitle,
      guid: feedItem.GUID,
      title: feedItem.Title,
      link: feedItem.Link,
      pubDate: new Date(feedItem.PubDate).toISOString(),
      author: feedItem.Author,
      inputDate: new Date().toISOString(),
      imageUrl: feedItem.ImageUrl,
      enclosureUrl: feedItem.EnclosureUrl,
      enclosureLength: String(feedItem.EnclosureLength),
      enclosureType: feedItem.EnclosureType,
      duration: feedItem.Duration,
      episode: feedItem.Episode,
      explicit: feedItem.Explicit,
      season: feedItem.Season,
      episodetype: feedItem.EpisodeType,
      source: feedItem.Source,
      description: descriptionBuffer,
    })
  }
}

export async function getFeedItemByIdentifiers(
  db: DbClient,
  channelId: string,
  guid: string
): Promise<FeedItem | null> {
  const queryResult = await db
    .select()
    .from(schema.feedItem)
    .where(
      or(
        eq(schema.feedItem.channelId, channelId),
        eq(schema.feedItem.id, guid),
      )
    )
    .limit(1) as FeedItemDto[]

  if (queryResult.length === 0) {
    return null
  }

  return mapFeedItemDtoToFeedItem({
    ...queryResult[0],
    count: 0,
    exclude_feed_id: '',
    country: queryResult[0].country || '',
  })
}
