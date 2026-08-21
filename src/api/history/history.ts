import { createOrUpdateFeedItem, getFeedItemByIdentifiers } from "../../db/feed_item";
import { FeedItem } from "../../models/feeds";
import { formatDateTime, generateFeedItemId } from "../../utils/common";
import { getPodcastEpisodeInfo } from "../../utils/itunes";
import { RecordListenHistoryRequest } from "./types";
import type { DbClient } from "../../db/types";
import { UserListenHistoryDto, upsertUserListenHistory, queryUserListenHistoryList, queryUserListenHistoryTotalCount, disableUserListenHistoryItem } from "../../db/history";
import { logger } from "../../utils/logger";
import { getSpotifyEpisodeDetail } from "../../utils/spotify";
import { PODCAST_SOURCES } from "../../models/types";

export async function recordEpisodeListenHistory(db: DbClient, request: RecordListenHistoryRequest): Promise<string> {
    const normalizedSource = request.source?.trim().toLowerCase() || PODCAST_SOURCES.ITUNES
    let feedItem: FeedItem | null = null
    
    if (request.channelId && request.itemId) {
        try {
            feedItem = await getFeedItemByIdentifiers(db, request.channelId, request.itemId)
            if (!feedItem) {
                if (normalizedSource === PODCAST_SOURCES.ITUNES) {
                    const itemInfoResp = await getPodcastEpisodeInfo(request.channelId, request.itemId)
                    if (itemInfoResp?.episode) {
                        feedItem = itemInfoResp.episode
                    }
                } else if (normalizedSource === PODCAST_SOURCES.SPOTIFY) {
                    feedItem = await getSpotifyEpisodeDetail(request.itemId)
                }

                if (feedItem) {
                    feedItem.Source = feedItem.Source || normalizedSource
                    feedItem.Id = await generateFeedItemId(feedItem.FeedLink, feedItem.Title)
                    feedItem.ChannelId = await generateFeedItemId(feedItem.FeedLink, feedItem.ChannelTitle)
                    await createOrUpdateFeedItem(db, feedItem)
                }
            }
        } catch (e) {
            logger.warn('Failed to resolve feed item for history recording', e)
        }
    }

    const resolvedItemId = feedItem?.Id || request.itemId
    const resolvedChannelId = feedItem?.ChannelId || request.channelId || ''

    try {
        await upsertUserListenHistory(db, {
            userId: request.userId,
            itemId: resolvedItemId,
            channelId: resolvedChannelId,
            duration: request.duration || feedItem?.Duration || '',
            position: request.position || 0,
            source: normalizedSource,
        })
    } catch (error) {
        logger.error('Recording podcast listen history failed: ', error);
        throw new Error('Something went wrong')
    }

    return 'Done'
}

export async function getUserListenHistory(db: DbClient, userId: string, limit: number, offset: number): Promise<UserListenHistoryDto[]> {
    let queryListData: UserListenHistoryDto[]
    let totalCount: number
    try {
        queryListData = await queryUserListenHistoryList(db, userId, limit, offset)
        totalCount = await queryUserListenHistoryTotalCount(db, userId)
    } catch (error) {
        logger.error(`Query listen history list by userId ${userId}, offset ${offset}, limit ${limit} failed:`, error)
        throw new Error('Something went wrong')
    }

    for (const historyDto of queryListData) {
        historyDto.count = totalCount
        historyDto.pub_date = formatDateTime(historyDto.pub_date)
        historyDto.input_date = formatDateTime(historyDto.input_date)
        historyDto.reg_date = formatDateTime(historyDto.reg_date)
        historyDto.update_date = formatDateTime(historyDto.update_date)
    }

    return queryListData
}

export async function removeEpisodeFromListenHistory(db: DbClient, userId: string, itemId: string): Promise<void> {
    const success = await disableUserListenHistoryItem(db, userId, itemId)
    if (!success) throw new Error('Listen history entry not found')
}
