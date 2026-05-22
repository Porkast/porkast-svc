import { eq, and, sql } from 'drizzle-orm'
import { UserPlaylistDto, UserPlaylistEntity, UserPlaylistItemDto, UserPLaylistItemEntity } from "../models/playlist"
import { formatDateTime } from "../utils/common"
import { decodeDatabaseText } from "../utils/text"
import * as schema from './schema'

type DbClient = ReturnType<typeof import('./client').createDb>

export async function queryPlaylistByPlaylistId(db: DbClient, playlistId: string): Promise<UserPlaylistDto | null> {
  const queryResult = await db
    .select()
    .from(schema.userPlaylist)
    .where(eq(schema.userPlaylist.id, playlistId))
    .limit(1)

  if (queryResult.length === 0) {
    return null
  }

  const row = queryResult[0]
  return {
    Id: row.id,
    PlaylistName: row.playlistName || '',
    Description: decodeDatabaseText(row.description),
    UserId: row.userId || '',
    Status: row.status || 0,
    CreatorId: row.creatorId || '',
    OrigPlaylistId: row.origPlaylistId || '',
    RegDate: row.regDate ? new Date(row.regDate) : new Date(),
    Count: 0,
  }
}

export async function queryUserPlaylistListByUserId(db: DbClient, userId: string, offset: number, limit: number): Promise<UserPlaylistDto[]> {
  const queryResult = await db.all<UserPlaylistEntity>(sql`
    SELECT up.*, COUNT(upi.id) as count 
    FROM user_playlist up 
    LEFT JOIN user_playlist_item upi ON upi.playlist_id = up.id
    WHERE up.user_id = ${userId} AND up.status = 1
    GROUP BY up.id
    ORDER BY up.reg_date DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `)

  return queryResult.map((result) => ({
    Id: result.id,
    PlaylistName: result.playlist_name || '',
    Description: decodeDatabaseText(result.description),
    UserId: result.user_id || '',
    Status: result.status || 0,
    CreatorId: result.creator_id || '',
    OrigPlaylistId: result.orig_playlist_id || '',
    RegDate: result.reg_date ? new Date(result.reg_date) : new Date(),
    Count: parseInt(String(result.count)),
  }))
}

export async function queryPlaylistItemsByPlaylistId(db: DbClient, playlistId: string, offset: number = 0, limit: number = 10): Promise<UserPlaylistItemDto[]> {
  const queryResult = await db.all<UserPLaylistItemEntity>(sql`
    SELECT fi.*, upi.reg_date, upi.playlist_id 
    FROM user_playlist_item upi
    JOIN feed_item fi ON upi.item_id = fi.id
    WHERE upi.playlist_id = ${playlistId} AND upi.status = 1
    ORDER BY upi.reg_date DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `)

  const totalCountResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.userPlaylistItem)
    .where(eq(schema.userPlaylistItem.playlistId, playlistId))
    .then((r) => Number(r[0]?.count || 0))

  return queryResult.map((result) => ({
    Id: result.id,
    FeedId: result.feed_id,
    GUID: result.guid || '',
    ChannelId: result.channel_id,
    Title: result.title || '',
    HighlightTitle: result.title || '',
    Link: result.link || '',
    PubDate: formatDateTime(result.pub_date?.toString() || new Date().toString()),
    Author: result.author || '',
    InputDate: formatDateTime(result.input_date?.toString() || new Date().toString()),
    ImageUrl: result.image_url || '',
    EnclosureUrl: result.enclosure_url || '',
    EnclosureType: result.enclosure_type || '',
    EnclosureLength: result.enclosure_length || '',
    Duration: result.duration || '',
    Episode: result.episode || '',
    Explicit: result.explicit || '',
    Season: result.season || '',
    EpisodeType: result.episodeType || '',
    Description: decodeDatabaseText(result.description),
    TextDescription: decodeDatabaseText(result.description),
    ChannelImageUrl: "",
    ChannelTitle: result.channel_title || '',
    HighlightChannelTitle: "",
    FeedLink: result.feed_link || '',
    Count: totalCountResult,
    Source: result.source || '',
    ExcludeFeedId: '',
    Country: result.country || '',
    TookTime: 0,
    HasThumbnail: true,
    RegDate: formatDateTime(result.reg_date?.toString() || new Date().toString()),
    Status: result.status || 0,
    PlaylistId: result.playlist_id || '',
  }))
}

export async function disablePlaylist(db: DbClient, playlistId: string): Promise<boolean> {
  const result = await db
    .update(schema.userPlaylist)
    .set({ status: 0 })
    .where(
      and(
        eq(schema.userPlaylist.id, playlistId),
        eq(schema.userPlaylist.status, 1),
      )
    )

  return (result as any)?.meta?.rows_written > 0 || (result as any)?.changes > 0
}
