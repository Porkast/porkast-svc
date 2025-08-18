import { queryPlaylistByPlaylistId } from "../../db/playlist";
import prisma from "../../db/prisma.client";
import { FeedItem } from "../../models/feeds";
import { generateFeedItemId, generatePlaylistId, generatePlaylistItemId } from "../../utils/common";
import { getPodcastEpisodeInfo } from "../../utils/itunes";

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
        console.log('create playlist error', error)
        return 'Something went wrong'
    }

    return 'Done'
}

export async function addPodcastToPlaylist(playlistId: string, channelId: string, source: string, guid: string): Promise<String> {

    const playlistInfo = await queryPlaylistByPlaylistId(playlistId)
    if (!playlistInfo) {
        const message = 'Playlist not found'
        throw new Error(message)
    }

    let itemInfoResp;
    if (source == 'itunes') {
        itemInfoResp = await getPodcastEpisodeInfo(channelId, guid)
    }

    if (!itemInfoResp) {
        const message = 'Podcast Episode not found'
        throw new Error(message)
    }

    let feedItem: FeedItem = itemInfoResp.episode
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
            console.log(message, error)
            throw new Error(message)
        }
    }

    return 'Done'
}