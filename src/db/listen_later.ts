import { eq, and, sql } from 'drizzle-orm'
import { UserListenLaterDto } from "../models/listen_later"
import { decodeDatabaseText } from "../utils/text"
import * as schema from './schema'

type DbClient = ReturnType<typeof import('./client').createDb>

export const queryUserListenLaterList = async (db: DbClient, userId: string, limit: number, offset: number): Promise<UserListenLaterDto[]> => {
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
      reg_date: schema.userListenLater.regDate,
      text_description: schema.feedItem.description,
    })
    .from(schema.userListenLater)
    .innerJoin(schema.feedItem, eq(schema.feedItem.id, schema.userListenLater.itemId))
    .where(
      and(
        eq(schema.userListenLater.userId, userId),
        eq(schema.userListenLater.status, 1),
      )
    )
    .orderBy(sql`${schema.userListenLater.regDate} DESC`)
    .limit(limit)
    .offset(offset)

  for (const item of result) {
    item.description = decodeDatabaseText(item.description)
    item.text_description = decodeDatabaseText(item.text_description || item.description)
  }

  return result as unknown as UserListenLaterDto[]
}

export const queryUserListenLaterTotalCount = async (db: DbClient, userId: string): Promise<number> => {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.userListenLater)
    .where(
      and(
        eq(schema.userListenLater.userId, userId),
        eq(schema.userListenLater.status, 1),
      )
    )
    .then((r) => Number(r[0]?.count || 0))
  return result
}

export async function disableUserListenLaterItem(db: DbClient, userId: string, itemId: string): Promise<boolean> {
  const result = await db
    .update(schema.userListenLater)
    .set({ status: 0 })
    .where(
      and(
        eq(schema.userListenLater.userId, userId),
        eq(schema.userListenLater.itemId, itemId),
        eq(schema.userListenLater.status, 1),
      )
    )

  return (result as any)?.meta?.rows_written > 0 || (result as any)?.changes > 0
}
