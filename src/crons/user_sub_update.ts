import { eq } from 'drizzle-orm'
import { createDb } from '../db/client'
import { userSubscription } from '../db/schema'
import { logger } from '../utils/logger'
import { setupTelegramWebhook } from '../telegram/bot.setup'
import { setSpotifyCredentials } from '../utils/spotify'
import type { Env, SubscriptionUpdateMessage } from '../env'

export async function handleCron(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(setupTelegramWebhook(env))
  setSpotifyCredentials(env.SPOTIFY_CLIENT_ID, env.SPOTIFY_CLIENT_SECRET)

  const db = createDb(env.DB)

  const subscriptions = await db
    .select()
    .from(userSubscription)
    .where(eq(userSubscription.status, 1))

  const messages: SubscriptionUpdateMessage[] = subscriptions.map((sub) => ({
    userId: sub.userId || '',
    keyword: sub.keyword || '',
    country: sub.country || '',
    source: sub.source || '',
    excludeFeedId: sub.excludeFeedId || '',
    subscriptionId: sub.id,
    latestId: sub.latestId || 0,
  }))

  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100)
    await env.SUB_UPDATE_QUEUE.sendBatch(batch.map((body) => ({ body })))
  }

  logger.info(`Enqueued ${messages.length} subscription updates from cron trigger`)
}
