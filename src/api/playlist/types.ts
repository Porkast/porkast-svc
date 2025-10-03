import { z } from 'zod';
import { PODCAST_SOURCES } from '../../models/types';

export const CreatePlaylistSchema = z.object({
    userId: z.string(),
    playlistName: z.string(),
    description: z.string().optional(),
})

export type CreatePlaylistRequestData = z.infer<typeof CreatePlaylistSchema>

export const AddPodcastToPlaylistSchema = z.object({
    playlistId: z.string(),
    channelId: z.string(),
    source: z.string().nullable().default(PODCAST_SOURCES.SPOTIFY),
    guid: z.string(),
})

export type AddPodcastToPlaylistRequestData = z.infer<typeof AddPodcastToPlaylistSchema>