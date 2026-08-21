import { z } from 'zod';
import { DEFAULT_PODCAST_SOURCE } from '../../models/types';

export const RecordListenHistorySchema = z.object({
    userId: z.string(),
    itemId: z.string(),
    channelId: z.string().optional().default(''),
    duration: z.string().optional().default(''),
    position: z.number().optional().default(0),
    source: z.string().nullable().default(DEFAULT_PODCAST_SOURCE),
})

export type RecordListenHistoryRequest = z.infer<typeof RecordListenHistorySchema>
