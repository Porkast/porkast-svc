import { describe, it, expect, mock } from 'bun:test'

const mockSubscriptions = [
  { id: 'sub-1', userId: 'user-A', keyword: 'Tech', country: 'US', source: 'itunes', excludeFeedId: '', latestId: 0, status: 1 },
  { id: 'sub-2', userId: 'user-A', keyword: 'AI', country: 'US', source: 'itunes', excludeFeedId: '', latestId: 5, status: 1 },
  { id: 'sub-3', userId: 'user-B', keyword: 'Music', country: 'US', source: 'spotify', excludeFeedId: '', latestId: 0, status: 1 },
]

mock.module('../db/client', () => ({
  createDb: () => ({
    select: () => ({
      from: () => ({
        where: async () => mockSubscriptions,
      }),
    }),
  }),
}))

import { handleCron } from './user_sub_update'

describe('handleCron subscription aggregation', () => {
  it('groups multiple subscriptions belonging to the same user into a single queue message', async () => {
    const enqueuedBatches: any[] = []
    const env: any = {
      DB: {} as any,
      SUB_UPDATE_QUEUE: {
        sendBatch: mock(async (batch: any[]) => {
          enqueuedBatches.push(batch)
        }),
      },
      SPOTIFY_CLIENT_ID: 'id',
      SPOTIFY_CLIENT_SECRET: 'secret',
      PODCAST_INDEX_API_KEY: 'key',
      PODCAST_INDEX_API_SECRET: 'secret',
      TELE_BOT_TOKEN: 'token',
      BOT_WEBHOOK_URL: 'url',
    }

    const ctx: any = {
      waitUntil: mock(() => {}),
    }

    await handleCron({} as any, env, ctx)

    expect(enqueuedBatches.length).toBe(1)
    const messages = enqueuedBatches[0].map((b: any) => b.body)
    expect(messages.length).toBe(2) // user-A and user-B

    const userAMsg = messages.find((m: any) => m.userId === 'user-A')
    expect(userAMsg).toBeDefined()
    expect(userAMsg.subscriptions.length).toBe(2)
    expect(userAMsg.subscriptions.map((s: any) => s.keyword)).toEqual(['Tech', 'AI'])

    const userBMsg = messages.find((m: any) => m.userId === 'user-B')
    expect(userBMsg).toBeDefined()
    expect(userBMsg.subscriptions.length).toBe(1)
    expect(userBMsg.subscriptions[0].keyword).toBe('Music')
  })
})
