import { z } from 'zod';

export const CreatePlaylistSchema = z.object({
    userId: z.string(),
    playlistName: z.string(),
    description: z.string().optional(),
})

export type CreatePlaylistRequestData = z.infer<typeof CreatePlaylistSchema>