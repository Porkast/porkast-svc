import { z } from 'zod';
import { DEFAULT_PODCAST_SOURCE } from '../../models/types';

export const AddPodcastToListenLaterSchema = z.object({
    userId: z.string(),
    itemId: z.string(),
    channelId: z.string(),
    source: z.string().nullable().default(DEFAULT_PODCAST_SOURCE),
})

export type AddPodcastToListenLaterRequest = z.infer<typeof AddPodcastToListenLaterSchema>
