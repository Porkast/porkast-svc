import { eq, and, desc, sql } from 'drizzle-orm'
import { createDb } from '../db/client'
import { userSubscription, userInfo, keywordSubscription, feedItem } from '../db/schema'
import { searchPodcastEpisodeFromItunes } from '../utils/itunes'
import { searchSpotifyEpisodes } from '../utils/spotify'
import { buildFeedItemAndKeywordInputList } from '../utils/itunes'
import { logger } from '../utils/logger'
import { sendSubscriptionNewUpdateMessage } from '../telegram/bot'
import { sendSubscriptionUpdateEmail } from '../email/resend'
import { getNickname } from '../utils/common'
import type { NotificationParams } from '../models/subscription'
import type { FeedItem as FeedItemType } from '../models/feeds'
import { PODCAST_SOURCES } from '../models/types'
import type { Env, SubscriptionUpdateMessage } from '../env'
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

async function getLatestPubDateForSubscription(
  db: ReturnType<typeof createDb>,
  keyword: string,
  country: string,
  source: string,
  excludeFeedId: string
): Promise<Date | null> {
  const result = await db
    .select({ pubDate: feedItem.pubDate })
    .from(feedItem)
    .innerJoin(keywordSubscription, eq(feedItem.id, keywordSubscription.feedItemId))
    .where(
      and(
        eq(keywordSubscription.keyword, keyword),
        eq(keywordSubscription.country, country),
        eq(keywordSubscription.source, source),
        eq(keywordSubscription.excludeFeedId, excludeFeedId),
      )
    )
    .orderBy(desc(feedItem.pubDate))
    .limit(1)

  return result[0]?.pubDate ? new Date(result[0].pubDate) : null
}

export async function handleSubscriptionUpdate(
  batch: MessageBatch<SubscriptionUpdateMessage>,
  env: Env,
  ctx: ExecutionContext
) {
  for (const msg of batch.messages) {
    const { userId, keyword, country, source, excludeFeedId, latestId } = msg.body

    try {
      let feedItemList: FeedItemType[]
      if (source === PODCAST_SOURCES.ITUNES) {
        feedItemList = await searchPodcastEpisodeFromItunes(keyword, 'podcastEpisode', country, excludeFeedId, 0, 0, 200)
      } else if (source === PODCAST_SOURCES.SPOTIFY) {
        feedItemList = await searchSpotifyEpisodes(keyword, country, 50, 0)
      } else {
        feedItemList = []
      }

      if (!feedItemList || feedItemList.length === 0) {
        msg.ack()
        continue
      }

      const db = createDb(env.DB)
      const latestPubDate = await getLatestPubDateForSubscription(db, keyword, country, source, excludeFeedId)

      if (latestPubDate) {
        feedItemList = feedItemList.filter((item) => {
          const itemDate = new Date(item.PubDate)
          if (isNaN(itemDate.getTime())) return true
          return itemDate > latestPubDate
        })
      }

      if (feedItemList.length === 0) {
        msg.ack()
        continue
      }

      const model = await buildFeedItemAndKeywordInputList(keyword, country, excludeFeedId, source, feedItemList)

      try {
        const ksChunks = chunkArray(model.keywordSubscriptionList, 14)
        for (const chunk of ksChunks) {
          await db.insert(keywordSubscription).values(chunk)
        }
      } catch (e: any) {
        if (e?.message?.includes('UNIQUE constraint failed')) {
          logger.warn('UNIQUE constraint violation for keyword_subscription, ignoring')
        } else {
          logger.error('Insert keyword subscription list failed', e)
        }
      }

      try {
        const fiChunks = chunkArray(model.feedItemList, 4)
        for (const chunk of fiChunks) {
          await db.insert(feedItem).values(chunk)
        }
      } catch (e: any) {
        if (e?.message?.includes('UNIQUE constraint failed')) {
          logger.warn('UNIQUE constraint violation for feed_item, ignoring')
        } else {
          logger.error('Insert feed item list failed', e)
        }
      }

      ctx.waitUntil(notifyUser(env, db, userId, keyword, country, source, excludeFeedId))

      msg.ack()
    } catch (error) {
      logger.error(`Failed to process subscription: ${userId}/${keyword}`, error)
      if (msg.attempts < 3) {
        msg.retry()
      } else {
        msg.ack()
      }
    }
  }
}

async function notifyUser(
  env: Env,
  db: ReturnType<typeof createDb>,
  userId: string,
  keyword: string,
  country: string,
  source: string,
  excludeFeedId: string,
) {
  try {
    const [usEntity, uInfo] = await Promise.all([
      db
        .select()
        .from(userSubscription)
        .where(
          and(
            eq(userSubscription.keyword, keyword),
            eq(userSubscription.country, country),
            eq(userSubscription.excludeFeedId, excludeFeedId),
            eq(userSubscription.source, source),
            eq(userSubscription.userId, userId),
          )
        )
        .limit(1),

      db
        .select()
        .from(userInfo)
        .where(eq(userInfo.id, userId))
        .limit(1),
    ])

    const usEnrity = usEntity[0]
    const user = uInfo[0]

    if (!usEnrity || !user) return

    const ksList = await db
      .select({
        id: feedItem.id,
        feed_id: feedItem.feedId,
        guid: feedItem.guid,
        channel_id: feedItem.channelId,
        title: feedItem.title,
        link: feedItem.link,
        pub_date: feedItem.pubDate,
        author: feedItem.author,
        image_url: feedItem.imageUrl,
        enclosure_url: feedItem.enclosureUrl,
        enclosure_length: feedItem.enclosureLength,
        enclosure_type: feedItem.enclosureType,
        duration: feedItem.duration,
        channel_title: feedItem.channelTitle,
        feed_link: feedItem.feedLink,
      })
      .from(feedItem)
      .innerJoin(keywordSubscription, eq(feedItem.id, keywordSubscription.feedItemId))
      .innerJoin(
        userSubscription,
        and(
          eq(userSubscription.keyword, keywordSubscription.keyword),
          eq(userSubscription.country, keywordSubscription.country),
          eq(userSubscription.excludeFeedId, keywordSubscription.excludeFeedId),
          eq(userSubscription.source, keywordSubscription.source),
        ),
      )
      .where(
        and(
          eq(userSubscription.userId, userId),
          eq(userSubscription.keyword, keyword),
          eq(userSubscription.source, source),
          eq(userSubscription.country, country),
          eq(userSubscription.excludeFeedId, excludeFeedId),
          sql`${keywordSubscription.id} > ${usEnrity.latestId || 0}`,
          eq(userSubscription.status, 1),
        ),
      )
      .orderBy(desc(feedItem.pubDate))
      .limit(10)

    const totalCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(keywordSubscription)
      .where(
        and(
          eq(keywordSubscription.keyword, keyword),
          eq(keywordSubscription.source, source),
          eq(keywordSubscription.country, country),
          eq(keywordSubscription.excludeFeedId, excludeFeedId),
          sql`${keywordSubscription.id} > ${usEnrity.latestId || 0}`,
        ),
      )
      .then((r) => Number(r[0]?.count || 0))

    if (totalCount > 0 && ksList.length > 0) {
      const link = `${env.TELE_MINI_APP_LINK}/subscription/${user.telegramId}/${keyword}`

      if (user.telegramId) {
        sendSubscriptionNewUpdateMessage(env.TELE_BOT_TOKEN, env.TELE_MINI_APP_LINK, user.telegramId, keyword, totalCount, ksList as any, link)
      }

      if (user.email) {
        const emailParams: NotificationParams = {
          keyword: keyword,
          nickname: getNickname(user.email, user.nickname || ''),
          updateCount: totalCount,
          titleList: ksList.map((k) => k.title || ''),
          link: link,
          to: user.email,
          subject: "#" + keyword + " has new podcasts update",
        }
        try {
          await sendSubscriptionUpdateEmail(env.RESEND_API_KEY, emailParams)
        } catch (e) {
          logger.error('Send subscription update email failed', e)
        }
      }
    }

    const latestKs = await db
      .select({ id: keywordSubscription.id, createTime: keywordSubscription.createTime })
      .from(keywordSubscription)
      .where(
        and(
          eq(keywordSubscription.keyword, keyword),
          eq(keywordSubscription.source, source),
          eq(keywordSubscription.country, country),
          eq(keywordSubscription.excludeFeedId, excludeFeedId),
        ),
      )
      .orderBy(desc(keywordSubscription.id))
      .limit(1)

    const total = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(keywordSubscription)
      .where(
        and(
          eq(keywordSubscription.keyword, keyword),
          eq(keywordSubscription.source, source),
          eq(keywordSubscription.country, country),
          eq(keywordSubscription.excludeFeedId, excludeFeedId),
        ),
      )
      .then((r) => Number(r[0]?.count || 0))

    if (latestKs[0]?.id) {
      await db
        .update(userSubscription)
        .set({
          latestId: latestKs[0].id,
          updateTime: latestKs[0].createTime,
          totalCount: total,
        })
        .where(eq(userSubscription.id, usEnrity.id))
    }
  } catch (error) {
    logger.error(`Failed to notify user subscription updated: ${userId}/${keyword}`, error)
  }
}
