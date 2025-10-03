import { z } from 'zod';
import { PODCAST_SOURCES } from '../../models/types';

export const AddPodcastToListenLaterSchema = z.object({
    userId: z.string(),
    itemId: z.string(),
    channelId: z.string(),
    source: z.string().nullable().default(PODCAST_SOURCES.SPOTIFY),
})

export type AddPodcastToListenLaterRequest = z.infer<typeof AddPodcastToListenLaterSchema>
