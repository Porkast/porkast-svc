import { z } from 'zod';

export const AddPodcastToListenLaterSchema = z.object({
    userId: z.string(),
    itemId: z.string(),
    channelId: z.string(),
    source: z.string().nullable().default('itunes'),
})

export type AddPodcastToListenLaterRequest = z.infer<typeof AddPodcastToListenLaterSchema>
