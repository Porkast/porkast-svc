import { createOrUpdateFeedItem, getFeedItemByIdentifiers } from "../../db/feed_item";
import { FeedItem } from "../../models/feeds";
import { formatDateTime, generateFeedItemId } from "../../utils/common";
import { getPodcastEpisodeInfo } from "../../utils/itunes";
import { AddPodcastToListenLaterRequest } from "./types";
import type { DbClient } from "../../db/types";
import { eq, and } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { UserListenLaterDto } from "../../models/listen_later";
import { queryUserListenLaterList, queryUserListenLaterTotalCount, disableUserListenLaterItem } from "../../db/listen_later";
import { logger } from "../../utils/logger";
import { getSpotifyEpisodeDetail } from "../../utils/spotify";
import { PODCAST_SOURCES } from "../../models/types";

export async function addEpisodeToListenLater(db: DbClient, request: AddPodcastToListenLaterRequest): Promise<String> {
    const normalizedSource = request.source?.trim().toLowerCase() || PODCAST_SOURCES.ITUNES
    let feedItem: FeedItem | null = await getFeedItemByIdentifiers(db, request.channelId, request.itemId)

    if (!feedItem) {
        if (normalizedSource === PODCAST_SOURCES.ITUNES) {
            const itemInfoResp = await getPodcastEpisodeInfo(request.channelId, request.itemId)
            if (!itemInfoResp?.episode) {
                const message = 'Podcast Episode not found'
                throw new Error(message)
            }
            feedItem = itemInfoResp.episode
        } else if (normalizedSource === PODCAST_SOURCES.SPOTIFY) {
            feedItem = await getSpotifyEpisodeDetail(request.itemId)
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

    await createOrUpdateFeedItem(db, feedItem)

    const queryData = await db
        .select()
        .from(schema.userListenLater)
        .where(
            and(
                eq(schema.userListenLater.userId, request.userId),
                eq(schema.userListenLater.channelId, feedItem.ChannelId),
                eq(schema.userListenLater.itemId, feedItem.Id),
            )
        )
        .limit(1)

    if (queryData.length > 0) {
        throw new Error('Already added')
    }

    try {
        await db.insert(schema.userListenLater).values({
            id: crypto.randomUUID(),
            userId: request.userId,
            channelId: feedItem.ChannelId,
            itemId: feedItem.Id,
            regDate: new Date().toISOString(),
            status: 1,
        })
    } catch (error) {
        logger.error('Adding podcast to listen later: ', error);
        throw new Error('Something went wrong')
    }

    return 'Done'
}

export async function getUserListenLaterList(db: DbClient, userId: string, limit: number, offset: number): Promise<UserListenLaterDto[]> {
    let queryListData: UserListenLaterDto[]
    let totalCount: number
    try {
        queryListData = await queryUserListenLaterList(db, userId, limit, offset)
        totalCount = await queryUserListenLaterTotalCount(db, userId)
    } catch (error) {
        logger.error(`Query listen later list by userId ${userId}, offset ${offset}, limit ${limit} failed:`, error)
        throw new Error('Something went wrong')
    }

    for (const listenLaterDto of queryListData) {
        listenLaterDto.count = totalCount
        listenLaterDto.pub_date = formatDateTime(listenLaterDto.pub_date)
        listenLaterDto.input_date = formatDateTime(listenLaterDto.input_date)
        listenLaterDto.reg_date = formatDateTime(listenLaterDto.reg_date)
    }

    return queryListData
}

export async function removeEpisodeFromListenLater(db: DbClient, userId: string, itemId: string) {
    const success = await disableUserListenLaterItem(db, userId, itemId)
    if (!success) throw new Error('Listen later entry not found')
}
