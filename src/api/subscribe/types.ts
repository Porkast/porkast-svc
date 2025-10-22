import { z } from 'zod';
import { DEFAULT_PODCAST_SOURCE } from '../../models/types';

export const KeywordSubscribeSchema = z.object({
    userId: z.string(),
    keyword: z.string(),
    country: z.string().default('US'),
    excludeFeedId: z.string().optional(),
    source: z.string().default(DEFAULT_PODCAST_SOURCE),
    sortByDate: z.number().default(1),
})

export type KeywordSubscribeRequestData = z.infer<typeof KeywordSubscribeSchema>
