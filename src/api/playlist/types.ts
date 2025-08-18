import { z } from 'zod';

export const CreatePlaylistSchema = z.object({
    userId: z.string(),
    playlistName: z.string(),
    description: z.string().optional(),
})

export type CreatePlaylistRequestData = z.infer<typeof CreatePlaylistSchema>

export const AddPodcastToPlaylistSchema = z.object({
    playlistId: z.string(),
    channelId: z.string(),
    source: z.string().nullable().default('itunes'),
    guid: z.string(),
})

export type AddPodcastToPlaylistRequestData = z.infer<typeof AddPodcastToPlaylistSchema>