import { eq } from 'drizzle-orm'
import { createDb } from '../db/client'
import { userSubscription } from '../db/schema'
import { logger } from '../utils/logger'
import { setupTelegramWebhook } from '../telegram/bot.setup'
import { setSpotifyCredentials } from '../utils/spotify'
import { setPodcastIndexCredentials } from '../utils/podcast-index'
import type { Env, UserSubscriptionUpdateMessage, SubscriptionItemMessage } from '../env'

export async function handleCron(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
  ctx.waitUntil(setupTelegramWebhook(env))
  setSpotifyCredentials(env.SPOTIFY_CLIENT_ID, env.SPOTIFY_CLIENT_SECRET)
  setPodcastIndexCredentials(env.PODCAST_INDEX_API_KEY, env.PODCAST_INDEX_API_SECRET)

  const db = createDb(env.DB)

  const subscriptions = await db
    .select()
    .from(userSubscription)
    .where(eq(userSubscription.status, 1))

  const userMap = new Map<string, SubscriptionItemMessage[]>()
  for (const sub of subscriptions) {
    if (!sub.userId) continue
    const list = userMap.get(sub.userId) || []
    list.push({
      subscriptionId: sub.id,
      keyword: sub.keyword || '',
      country: sub.country || '',
      source: sub.source || '',
      excludeFeedId: sub.excludeFeedId || '',
      latestId: sub.latestId || 0,
    })
    userMap.set(sub.userId, list)
  }

  const messages: UserSubscriptionUpdateMessage[] = Array.from(userMap.entries()).map(
    ([userId, subs]) => ({
      userId,
      subscriptions: subs,
    })
  )

  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100)
    await env.SUB_UPDATE_QUEUE.sendBatch(batch.map((body) => ({ body })))
  }

  logger.info(
    `Enqueued ${messages.length} user subscription updates for ${subscriptions.length} total subscriptions from cron trigger`
  )
}
