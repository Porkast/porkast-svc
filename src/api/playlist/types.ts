import { z } from 'zod';
import { DEFAULT_PODCAST_SOURCE } from '../../models/types';

export const CreatePlaylistSchema = z.object({
    userId: z.string(),
    playlistName: z.string(),
    description: z.string().optional(),
})

export type CreatePlaylistRequestData = z.infer<typeof CreatePlaylistSchema>

export const AddPodcastToPlaylistSchema = z.object({
    playlistId: z.string(),
    channelId: z.string(),
    source: z.string().nullable().default(DEFAULT_PODCAST_SOURCE),
    guid: z.string(),
})

export type AddPodcastToPlaylistRequestData = z.infer<typeof AddPodcastToPlaylistSchema>