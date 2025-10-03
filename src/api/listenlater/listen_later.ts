import { createOrUpdateFeedItem } from "../../db/feed_item";
import { FeedChannel, FeedItem } from "../../models/feeds";
import { formatDateTime, generateFeedItemId, generateID } from "../../utils/common";
import { getPodcastEpisodeInfo } from "../../utils/itunes";
import { AddPodcastToListenLaterRequest } from "./types";
import prisma from "../../db/prisma.client";
import { UserListenLaterDto } from "../../models/listen_later";
import { queryUserListenLaterList, queryUserListenLaterTotalCount } from "../../db/listen_later";
import { logger } from "../../utils/logger";
import { getSpotifyEpisodeDetail } from "../../utils/spotify";
import { PODCAST_SOURCES } from "../../models/types";


export async function addEpisodeToListenLater(request: AddPodcastToListenLaterRequest): Promise<String> {
    let itemInfoResp;
    let feedItem: FeedItem
    if (request.source == PODCAST_SOURCES.ITUNES) {
        itemInfoResp = await getPodcastEpisodeInfo(request.channelId, request.itemId)
        feedItem = itemInfoResp.episode
    } else {
        feedItem = await getSpotifyEpisodeDetail(request.itemId)
    }

    if (!itemInfoResp) {
        const message = 'Podcast Episode not found'
        throw new Error(message)
    }

    feedItem.Id = await generateFeedItemId(feedItem.FeedLink, feedItem.Title)
    feedItem.ChannelId = await generateFeedItemId(feedItem.FeedLink, feedItem.ChannelTitle)

    await createOrUpdateFeedItem(feedItem)

    const queryData = await prisma.user_listen_later.findFirst({
        where: {
            user_id: request.userId,
            channel_id: feedItem.ChannelId,
            item_id: feedItem.Id,
        },
    })

    if (queryData) {
        throw new Error('Already added')
    }

    try {
        await prisma.user_listen_later.create({
            data: {
                id: await generateID(),
                user_id: request.userId,
                channel_id: feedItem.ChannelId,
                item_id: feedItem.Id,
                reg_date: new Date(),
                status: 1,
            }
        })
    } catch (error) {
        logger.error('Adding podcast to listen later: ', error);
        throw new Error('Something went wrong')
    }

    return 'Done'
}

export async function getUserListenLaterList(userId: string, limit: number, offset: number): Promise<UserListenLaterDto[]> {
    let queryListData: UserListenLaterDto[]
    let totalCount: number
    try {
        queryListData = await queryUserListenLaterList(userId, limit, offset)
        totalCount = await queryUserListenLaterTotalCount(userId)
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