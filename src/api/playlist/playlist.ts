import { createOrUpdateFeedItem } from "../../db/feed_item";
import { queryPlaylistByPlaylistId, queryPlaylistItemsByPlaylistId, queryUserPlaylistListByUserId } from "../../db/playlist";
import prisma from "../../db/prisma.client";
import { FeedItem } from "../../models/feeds";
import { UserPlaylistDto, UserPlaylistItemDto } from "../../models/playlist";
import { PODCAST_SOURCES } from "../../models/types";
import { generateFeedItemId, generatePlaylistId, generatePlaylistItemId } from "../../utils/common";
import { getPodcastEpisodeInfo } from "../../utils/itunes";
import { logger } from "../../utils/logger";
import { getSpotifyEpisodeDetail } from "../../utils/spotify";
import { UserInfo } from "../user/types";

export async function createPlaylist(userId: string, playlistName: string, description: string): Promise<String> {
    try {
        await prisma.user_playlist.create({
            data: {
                id: await generatePlaylistId(playlistName, userId),
                user_id: userId,
                playlist_name: playlistName,
                description: Buffer.from(description),
            }
        })
    } catch (error) {
        logger.error('create playlist error', error)
        return 'Something went wrong'
    }

    return 'Done'
}

export async function getUserPlaylistList(userId: string, limit: string, offset: string): Promise<UserPlaylistDto[]> {
    const limitInt = parseInt(limit)
    const offsetInt = parseInt(offset)
    const resultDtos = await queryUserPlaylistListByUserId(userId, offsetInt, limitInt)
    return resultDtos
}

export async function addPodcastToPlaylist(playlistId: string, channelId: string, source: string, guid: string): Promise<String> {

    const playlistInfo = await queryPlaylistByPlaylistId(playlistId)
    if (!playlistInfo) {
        const message = 'Playlist not found'
        throw new Error(message)
    }

    let itemInfoResp;
    let feedItem: FeedItem
    if (source == PODCAST_SOURCES.ITUNES) {
        itemInfoResp = await getPodcastEpisodeInfo(channelId, guid)
        feedItem = itemInfoResp.episode
    } else {
        feedItem = await getSpotifyEpisodeDetail(guid)
    }

    if (!itemInfoResp) {
        const message = 'Podcast Episode not found'
        throw new Error(message)
    }

    feedItem.Id = await generateFeedItemId(feedItem.FeedLink, feedItem.Title)
    feedItem.ChannelId = await generateFeedItemId(feedItem.FeedLink, feedItem.ChannelTitle)

    const playListeItemId = await generatePlaylistItemId(playlistId, feedItem.Id)
    const playlistItemQueryResult = await prisma.user_playlist_item.findUnique({
        where: {
            id: playListeItemId
        }
    })

    if (playlistItemQueryResult) {
        return 'Already exists'
    } else {
        try {
            await createOrUpdateFeedItem(feedItem)
        } catch (error) {
            logger.error('store feed item for playlist error: ', error)
            throw new Error('Something went wrong')
        }
        try {
            await prisma.user_playlist_item.create({
                data: {
                    id: playListeItemId,
                    playlist_id: playlistId,
                    item_id: feedItem.Id,
                    channel_id: feedItem.ChannelId,
                    reg_date: new Date(),
                    status: 1
                }
            })
        } catch (error) {
            const message = 'Something went wrong'
            logger.error('add podcast to playlist error: ', error)
            throw new Error(message)
        }
    }

    return 'Done'
}

export async function getPlaylistById(playlistId: string): Promise<{ playlist: UserPlaylistDto, userInfo: UserInfo } | null> {
    const playlistInfo = await queryPlaylistByPlaylistId(playlistId)
    if (!playlistInfo) {
        return null
    }

    const totalCount = await prisma.user_playlist_item.count({
        where: {
            playlist_id: playlistId
        }
    })
    playlistInfo.Count = totalCount

    let creatorId = ''
    if (!playlistInfo.CreatorId) {
        creatorId = playlistInfo.UserId
    } else {
        creatorId = playlistInfo.CreatorId
    }

    const creatorInfo = await prisma.user_info.findUnique({
        where: {
            id: creatorId
        }
    })

    if (!creatorInfo) {
        return null
    }

    const userInfo: UserInfo = {
        userId: creatorInfo.id,
        telegramId: creatorInfo.telegram_id || '',
        nickname: creatorInfo.nickname || '',
        password: '',
        email: creatorInfo.email || '',
        phone: creatorInfo.phone || '',
        avatar: creatorInfo.avatar || '',
        regDate: creatorInfo.reg_date || new Date(),
        updateDate: creatorInfo.update_date || new Date()
    }

    return {
        playlist: playlistInfo,
        userInfo
    }
}

export async function getPlaylistPodcastList(userId: string, playlistId: string, limit: string, offset: string): Promise<{ userInfo: UserInfo, playlist: UserPlaylistItemDto[]}> {
    const playlistInfoResult = await prisma.user_playlist_item.findFirst({
        where: {
            playlist_id: playlistId
        }
    })

    if (!playlistInfoResult) {
        throw new Error('Playlist not found')
    }

    const userInfoResult = await prisma.user_info.findFirst({
        where: {
            id: userId
        }
    })

    if (!userInfoResult) {
        throw new Error('User not found')
    }

    const userInfo: UserInfo = {
        userId: userInfoResult?.id,
        nickname: userInfoResult?.nickname || '',
        email: userInfoResult?.email || '',
        phone: userInfoResult?.phone || '',
        avatar: userInfoResult?.avatar || '',
        regDate: userInfoResult?.reg_date || new Date(),
        updateDate: userInfoResult.update_date || new Date(),
        password: '',
        telegramId: userInfoResult?.telegram_id || ''
    }

    const playlist = await queryPlaylistItemsByPlaylistId(playlistId)

    return {
        userInfo,
        playlist
    }
}
