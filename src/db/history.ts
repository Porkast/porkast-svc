import { eq, and, sql } from 'drizzle-orm'
import { decodeDatabaseText } from "../utils/text"
import * as schema from './schema'

type DbClient = ReturnType<typeof import('./client').createDb>

export interface UserListenHistoryRecord {
  userId: string
  itemId: string
  channelId?: string
  duration?: string
  position?: number
  source?: string
}

export interface UserListenHistoryDto {
  id: string
  guid: string
  channel_id: string
  feed_id: string
  title: string
  highlightTitle: string
  link: string
  pub_date: string
  author: string
  input_date: string
  image_url: string
  enclosure_url: string
  enclosure_type: string
  enclosure_length: string
  duration: string
  episode: string
  explicit: string
  season: string
  episodeType: string
  description: string
  text_description: string
  channel_image_url: string
  channel_title: string
  highlightChannelTitle: string
  feed_link: string
  count: number
  tookTime: number
  hasThumbnail: boolean
  source: string
  country: string
  reg_date: string
  update_date: string
  position: number
  is_listened: boolean
}

export async function upsertUserListenHistory(db: DbClient, record: UserListenHistoryRecord): Promise<void> {
  const now = new Date().toISOString()
  const existing = await db
    .select()
    .from(schema.userListenHistory)
    .where(
      and(
        eq(schema.userListenHistory.userId, record.userId),
        eq(schema.userListenHistory.itemId, record.itemId),
      )
    )
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(schema.userListenHistory)
      .set({
        position: record.position ?? existing[0].position,
        duration: record.duration ?? existing[0].duration,
        channelId: record.channelId ?? existing[0].channelId,
        source: record.source ?? existing[0].source,
        updateDate: now,
        status: 1,
      })
      .where(eq(schema.userListenHistory.id, existing[0].id))
  } else {
    await db.insert(schema.userListenHistory).values({
      id: crypto.randomUUID(),
      userId: record.userId,
      itemId: record.itemId,
      channelId: record.channelId ?? '',
      duration: record.duration ?? '',
      position: record.position ?? 0,
      source: record.source ?? '',
      regDate: now,
      updateDate: now,
      status: 1,
    })
  }
}

export async function queryUserListenHistoryList(
  db: DbClient,
  userId: string,
  limit: number,
  offset: number
): Promise<UserListenHistoryDto[]> {
  const result = await db
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
      enclosure_type: schema.feedItem.enclosureType,
      enclosure_length: schema.feedItem.enclosureLength,
      duration: schema.feedItem.duration,
      episode: schema.feedItem.episode,
      explicit: schema.feedItem.explicit,
      season: schema.feedItem.season,
      episodetype: schema.feedItem.episodetype,
      description: schema.feedItem.description,
      channel_title: schema.feedItem.channelTitle,
      feed_link: schema.feedItem.feedLink,
      source: schema.feedItem.source,
      country: schema.feedItem.source,
      reg_date: schema.userListenHistory.regDate,
      update_date: schema.userListenHistory.updateDate,
      position: schema.userListenHistory.position,
      text_description: schema.feedItem.description,
    })
    .from(schema.userListenHistory)
    .innerJoin(schema.feedItem, eq(schema.feedItem.id, schema.userListenHistory.itemId))
    .where(
      and(
        eq(schema.userListenHistory.userId, userId),
        eq(schema.userListenHistory.status, 1),
      )
    )
    .orderBy(sql`${schema.userListenHistory.updateDate} DESC`)
    .limit(limit)
    .offset(offset)

  return result.map((item) => ({
    id: item.id,
    guid: item.guid || item.id,
    channel_id: item.channel_id,
    feed_id: item.feed_id,
    title: item.title || '',
    highlightTitle: item.title || '',
    link: item.link || '',
    pub_date: item.pub_date || '',
    author: item.author || '',
    input_date: item.input_date || '',
    image_url: item.image_url || '',
    enclosure_url: item.enclosure_url || '',
    enclosure_type: item.enclosure_type || '',
    enclosure_length: item.enclosure_length || '',
    duration: item.duration || '',
    episode: item.episode || '',
    explicit: item.explicit || '',
    season: item.season || '',
    episodeType: item.episodetype || '',
    description: decodeDatabaseText(item.description),
    text_description: decodeDatabaseText(item.text_description || item.description),
    channel_image_url: '',
    channel_title: item.channel_title || '',
    highlightChannelTitle: '',
    feed_link: item.feed_link || '',
    count: 0,
    tookTime: 0,
    hasThumbnail: true,
    source: item.source || '',
    country: item.country || '',
    reg_date: item.reg_date || '',
    update_date: item.update_date || '',
    position: item.position || 0,
    is_listened: true,
  }))
}

export async function queryUserListenHistoryTotalCount(db: DbClient, userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.userListenHistory)
    .where(
      and(
        eq(schema.userListenHistory.userId, userId),
        eq(schema.userListenHistory.status, 1),
      )
    )
    .then((r) => Number(r[0]?.count || 0))
  return result
}

export async function disableUserListenHistoryItem(db: DbClient, userId: string, itemId: string): Promise<boolean> {
  const result = await db
    .update(schema.userListenHistory)
    .set({ status: 0 })
    .where(
      and(
        eq(schema.userListenHistory.userId, userId),
        eq(schema.userListenHistory.itemId, itemId),
        eq(schema.userListenHistory.status, 1),
      )
    )

  return (result as any)?.meta?.rows_written > 0 || (result as any)?.changes > 0
}
