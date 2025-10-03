import { z } from 'zod';
import { PODCAST_SOURCES } from '../../models/types';

export const KeywordSubscribeSchema = z.object({
    userId: z.string(),
    keyword: z.string(),
    country: z.string().default('US'),
    excludeFeedId: z.string().optional(),
    source: z.string().default(PODCAST_SOURCES.SPOTIFY),
    sortByDate: z.number().default(1),
})

export type KeywordSubscribeRequestData = z.infer<typeof KeywordSubscribeSchema>
