import { createOrUpdateFeedItem, getFeedItemByIdentifiers } from "../../db/feed_item";
import { queryPlaylistByPlaylistId, queryPlaylistItemsByPlaylistId, queryUserPlaylistListByUserId, disablePlaylist } from "../../db/playlist";
import { FeedItem } from "../../models/feeds";
import { UserPlaylistDto, UserPlaylistItemDto } from "../../models/playlist";
import { PODCAST_SOURCES } from "../../models/types";
import { generateFeedItemId, generatePlaylistId, generatePlaylistItemId } from "../../utils/common";
import { getPodcastEpisodeInfo } from "../../utils/itunes";
import { logger } from "../../utils/logger";
import { getSpotifyEpisodeDetail } from "../../utils/spotify";
import { UserInfo } from "../user/types";
import type { DbClient } from "../../db/types";
import { eq, sql } from 'drizzle-orm';
import * as schema from '../../db/schema';

export async function createPlaylist(db: DbClient, userId: string, playlistName: string, description: string): Promise<String> {
    try {
        await db.insert(schema.userPlaylist).values({
            id: await generatePlaylistId(playlistName, userId),
            userId: userId,
            playlistName: playlistName,
            description: new TextEncoder().encode(description),
        })
    } catch (error) {
        logger.error('create playlist error', error)
        return 'Something went wrong'
    }

    return 'Done'
}

export async function getUserPlaylistList(db: DbClient, userId: string, limit: string, offset: string): Promise<UserPlaylistDto[]> {
    const limitInt = parseInt(limit)
    const offsetInt = parseInt(offset)
    const resultDtos = await queryUserPlaylistListByUserId(db, userId, offsetInt, limitInt)
    return resultDtos
}

export async function addPodcastToPlaylist(db: DbClient, playlistId: string, channelId: string, source: string, guid: string): Promise<String> {

    const playlistInfo = await queryPlaylistByPlaylistId(db, playlistId)
    if (!playlistInfo) {
        const message = 'Playlist not found'
        throw new Error(message)
    }

    const normalizedSource = source?.trim().toLowerCase() || PODCAST_SOURCES.ITUNES
    let feedItem: FeedItem | null = await getFeedItemByIdentifiers(db, channelId, guid)
    if (!feedItem) {
        if (normalizedSource == PODCAST_SOURCES.ITUNES) {
            const itemInfoResp = await getPodcastEpisodeInfo(channelId, guid)
            if (!itemInfoResp?.episode) {
                const message = 'Podcast Episode not found'
                throw new Error(message)
            }
            feedItem = itemInfoResp.episode
        } else if (normalizedSource === PODCAST_SOURCES.SPOTIFY) {
            feedItem = await getSpotifyEpisodeDetail(guid)
        } else {
            throw new Error('Podcast Episode not found')
        }
    }

    if (!feedItem) {
        const message = 'Podcast Episode not found'
        throw new Error(message)
    }

    feedItem.Source = feedItem.Source || normalizedSource

    feedItem.Id = await generateFeedItemId(feedItem.FeedLink, feedItem.Title)
    feedItem.ChannelId = await generateFeedItemId(feedItem.FeedLink, feedItem.ChannelTitle)

    const playListeItemId = await generatePlaylistItemId(playlistId, feedItem.Id)
    const playlistItemQueryResult = await db
        .select()
        .from(schema.userPlaylistItem)
        .where(eq(schema.userPlaylistItem.id, playListeItemId))
        .limit(1)

    if (playlistItemQueryResult.length > 0) {
        return 'Already exists'
    } else {
        try {
            await createOrUpdateFeedItem(db, feedItem)
        } catch (error) {
            logger.error('store feed item for playlist error: ', error)
            throw new Error('Something went wrong')
        }
        try {
            await db.insert(schema.userPlaylistItem).values({
                id: playListeItemId,
                playlistId: playlistId,
                itemId: feedItem.Id,
                channelId: feedItem.ChannelId,
                regDate: new Date().toISOString(),
                status: 1,
            })
        } catch (error) {
            const message = 'Something went wrong'
            logger.error('add podcast to playlist error: ', error)
            throw new Error(message)
        }
    }

    return 'Done'
}

export async function getPlaylistById(db: DbClient, playlistId: string): Promise<{ playlist: UserPlaylistDto, userInfo: UserInfo } | null> {
    const playlistInfo = await queryPlaylistByPlaylistId(db, playlistId)
    if (!playlistInfo) {
        return null
    }

    const totalCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.userPlaylistItem)
        .where(eq(schema.userPlaylistItem.playlistId, playlistId))
        .then(r => r[0]?.count || 0)
    playlistInfo.Count = totalCount

    let creatorId = ''
    if (!playlistInfo.CreatorId) {
        creatorId = playlistInfo.UserId
    } else {
        creatorId = playlistInfo.CreatorId
    }

    const creatorInfoResult = await db
        .select()
        .from(schema.userInfo)
        .where(eq(schema.userInfo.id, creatorId))
        .limit(1)

    const creatorInfo = creatorInfoResult[0]

    if (!creatorInfo) {
        return null
    }

    const userInfo: UserInfo = {
        userId: creatorInfo.id,
        telegramId: creatorInfo.telegramId || '',
        nickname: creatorInfo.nickname || '',
        password: '',
        email: creatorInfo.email || '',
        phone: creatorInfo.phone || '',
        avatar: creatorInfo.avatar || '',
        regDate: creatorInfo.regDate ? new Date(creatorInfo.regDate) : new Date(),
        updateDate: creatorInfo.updateDate ? new Date(creatorInfo.updateDate) : new Date()
    }

    return {
        playlist: playlistInfo,
        userInfo
    }
}

export async function getPlaylistPodcastList(db: DbClient, userId: string, playlistId: string, limit: string, offset: string): Promise<{ userInfo: UserInfo, playlist: UserPlaylistItemDto[]}> {
    const limitInt = parseInt(limit)
    const offsetInt = parseInt(offset)
    const playlistInfoResult = await db
        .select()
        .from(schema.userPlaylistItem)
        .where(eq(schema.userPlaylistItem.playlistId, playlistId))
        .limit(1)

    if (playlistInfoResult.length === 0) {
        throw new Error('Playlist not found')
    }

    const userInfoRowResult = await db
        .select()
        .from(schema.userInfo)
        .where(eq(schema.userInfo.id, userId))
        .limit(1)

    if (userInfoRowResult.length === 0) {
        throw new Error('User not found')
    }

    const userInfoRow = userInfoRowResult[0]
    const userInfo: UserInfo = {
        userId: userInfoRow.id,
        nickname: userInfoRow.nickname || '',
        email: userInfoRow.email || '',
        phone: userInfoRow.phone || '',
        avatar: userInfoRow.avatar || '',
        regDate: userInfoRow.regDate ? new Date(userInfoRow.regDate) : new Date(),
        updateDate: userInfoRow.updateDate ? new Date(userInfoRow.updateDate) : new Date(),
        password: '',
        telegramId: userInfoRow.telegramId || ''
    }

    const playlist = await queryPlaylistItemsByPlaylistId(db, playlistId, offsetInt, limitInt)

    return {
        userInfo,
        playlist
    }
}

export async function deletePlaylist(db: DbClient, playlistId: string) {
    const success = await disablePlaylist(db, playlistId)
    if (!success) throw new Error('Playlist not found')
}
