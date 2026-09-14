import { eq, and, desc, sql } from 'drizzle-orm'
import { createDb } from '../db/client'
import { userSubscription, userInfo, keywordSubscription, feedItem } from '../db/schema'
import { searchPodcastEpisodeFromItunes, buildFeedItemAndKeywordInputList, ItunesRateLimitError, ItunesProxyError, initItunesProxy } from '../utils/itunes'
import { searchSpotifyEpisodes } from '../utils/spotify'
import { searchEpisodesFromPodcastIndex } from '../utils/podcast-index'
import { logger } from '../utils/logger'
import { sendSubscriptionNewUpdateMessage, sendAggregatedSubscriptionNewUpdateMessage } from '../telegram/bot'
import { sendAggregatedSubscriptionUpdateEmail } from '../email/service'
import { getNickname } from '../utils/common'
import type { AggregatedNotificationParams, KeywordUpdateItem } from '../models/subscription'
import type { FeedItem as FeedItemType } from '../models/feeds'
import { PODCAST_SOURCES } from '../models/types'
import type { Env, SubscriptionItemMessage } from '../env'

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
    .where(
      sql`EXISTS (
        SELECT 1 FROM ${keywordSubscription}
        WHERE ${keywordSubscription.feedItemId} = ${feedItem.id}
          AND ${keywordSubscription.keyword} = ${keyword}
          AND ${keywordSubscription.country} = ${country}
          AND ${keywordSubscription.source} = ${source}
          AND ${keywordSubscription.excludeFeedId} = ${excludeFeedId}
      )`
    )
    .orderBy(desc(feedItem.pubDate))
    .limit(1)

  return result[0]?.pubDate ? new Date(result[0].pubDate) : null
}

export async function handleSubscriptionUpdate(
  batch: MessageBatch<unknown>,
  env: Env,
  ctx: ExecutionContext
) {
  let rateLimited = false
  let proxyFailed = false
  initItunesProxy(env)
  const db = createDb(env.DB)

  for (const msg of batch.messages) {
    const rawBody = msg.body as any
    const userId: string = rawBody.userId

    // Support both new UserSubscriptionUpdateMessage and legacy SubscriptionUpdateMessage
    const subscriptions: SubscriptionItemMessage[] = Array.isArray(rawBody.subscriptions)
      ? rawBody.subscriptions
      : [
          {
            subscriptionId: rawBody.subscriptionId || '',
            keyword: rawBody.keyword || '',
            country: rawBody.country || '',
            source: rawBody.source || '',
            excludeFeedId: rawBody.excludeFeedId || '',
            latestId: rawBody.latestId || 0,
          },
        ]

    try {
      const uInfo = await db
        .select()
        .from(userInfo)
        .where(eq(userInfo.id, userId))
        .limit(1)
      const user = uInfo[0]

      if (!user) {
        msg.ack()
        continue
      }

      const updatedKeywords: KeywordUpdateItem[] = []
      const subscriptionsToUpdate: Array<{
        id: string
        latestId: number
        updateTime: string | null
        totalCount: number
      }> = []

      for (const sub of subscriptions) {
        const { subscriptionId, keyword, country, source, excludeFeedId, latestId } = sub

        if (source === PODCAST_SOURCES.ITUNES && (rateLimited || proxyFailed)) {
          continue
        }

        try {
          let feedItemList: FeedItemType[]
          if (source === PODCAST_SOURCES.ITUNES) {
            await delay(Math.random() * 2000 + 500)
            feedItemList = await searchPodcastEpisodeFromItunes(keyword, 'podcastEpisode', country, excludeFeedId, 0, 0, 200)
          } else if (source === PODCAST_SOURCES.SPOTIFY) {
            feedItemList = await searchSpotifyEpisodes(keyword, country, 50, 0)
          } else if (source === PODCAST_SOURCES.PODCAST_INDEX) {
            await delay(Math.random() * 1000 + 200)
            feedItemList = await searchEpisodesFromPodcastIndex(keyword, country, excludeFeedId, 0, 0, 200)
          } else {
            feedItemList = []
          }

          if (feedItemList && feedItemList.length > 0) {
            const latestPubDate = await getLatestPubDateForSubscription(db, keyword, country, source, excludeFeedId)

            if (latestPubDate) {
              feedItemList = feedItemList.filter((item) => {
                const itemDate = new Date(item.PubDate)
                if (isNaN(itemDate.getTime())) return true
                return itemDate > latestPubDate
              })
            }

            if (feedItemList.length > 0) {
              const model = await buildFeedItemAndKeywordInputList(keyword, country, excludeFeedId, source, feedItemList)

              const ksChunks = chunkArray(model.keywordSubscriptionList, 14)
              for (const chunk of ksChunks) {
                try {
                  await db.insert(keywordSubscription).values(chunk)
                } catch (e: any) {
                  if (e?.message?.includes('UNIQUE constraint failed')) {
                    logger.warn('UNIQUE constraint violation for keyword_subscription, ignoring')
                  } else {
                    logger.error('Insert keyword subscription list failed', e)
                  }
                }
              }

              const fiChunks = chunkArray(model.feedItemList, 4)
              for (const chunk of fiChunks) {
                try {
                  await db.insert(feedItem).values(chunk)
                } catch (e: any) {
                  if (e?.message?.includes('UNIQUE constraint failed')) {
                    logger.warn('UNIQUE constraint violation for feed_item, ignoring')
                  } else {
                    logger.error('Insert feed item list failed', e)
                  }
                }
              }
            }
          }

          // Check for new items since latestId for this subscription
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
            .where(
              and(
                eq(keywordSubscription.keyword, keyword),
                eq(keywordSubscription.source, source),
                eq(keywordSubscription.country, country),
                eq(keywordSubscription.excludeFeedId, excludeFeedId),
                sql`${keywordSubscription.id} > ${latestId || 0}`,
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
                sql`${keywordSubscription.id} > ${latestId || 0}`,
              ),
            )
            .then((r) => Number(r[0]?.count || 0))

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

          if (totalCount > 0 && ksList.length > 0) {
            const miniAppLink = `${env.TELE_MINI_APP_LINK}/subscription/${user.telegramId || ''}/${keyword}`
            const webLink = `${env.PORKAST_WEB_BASE_URL}/subscription/${user.id}/${keyword}`
            const feedItems = ksList.map((k) => ({
              Id: k.id,
              FeedId: k.feed_id,
              GUID: k.guid,
              ChannelId: k.channel_id,
              Title: k.title,
              Link: k.link,
              PubDate: k.pub_date,
              Author: k.author,
              ImageUrl: k.image_url,
              EnclosureUrl: k.enclosure_url,
              EnclosureLength: k.enclosure_length,
              EnclosureType: k.enclosure_type,
              Duration: k.duration,
              ChannelTitle: k.channel_title,
              FeedLink: k.feed_link,
            } as import('../models/feeds').FeedItem))

            updatedKeywords.push({
              subscriptionId,
              keyword,
              updateCount: totalCount,
              titleList: ksList.map((k) => k.title || ''),
              link: webLink,
              miniAppLink,
              feedItems,
              latestKsId: latestKs[0]?.id || 0,
              latestKsCreateTime: latestKs[0]?.createTime || null,
              totalCount: total,
            })
          }

          if (latestKs[0]?.id && subscriptionId) {
            subscriptionsToUpdate.push({
              id: subscriptionId,
              latestId: latestKs[0].id,
              updateTime: latestKs[0].createTime,
              totalCount: total,
            })
          }
        } catch (subErr) {
          if (subErr instanceof ItunesRateLimitError) {
            rateLimited = true
            logger.warn('iTunes API rate limited, skipping remaining iTunes searches')
          }
          if (subErr instanceof ItunesProxyError) {
            proxyFailed = true
            logger.warn(`iTunes proxy failed: ${subErr.cause}`)
          }
          logger.error(`Error processing subscription for user ${userId}, keyword ${keyword}:`, subErr)
        }
      }

      // Notify user aggregated and update DB
      if (updatedKeywords.length > 0 || subscriptionsToUpdate.length > 0) {
        ctx.waitUntil(
          notifyUserAggregated(env, db, user, updatedKeywords, subscriptionsToUpdate)
        )
      }

      msg.ack()
    } catch (error) {
      logger.error(`Failed to process subscription update for user: ${userId}`, error)
      if (msg.attempts < 3) {
        msg.retry()
      } else {
        msg.ack()
      }
    }
  }
}

async function notifyUserAggregated(
  env: Env,
  db: ReturnType<typeof createDb>,
  user: typeof userInfo.$inferSelect,
  updatedKeywords: KeywordUpdateItem[],
  subscriptionsToUpdate: Array<{
    id: string
    latestId: number
    updateTime: string | null
    totalCount: number
  }>
) {
  try {
    if (updatedKeywords.length > 0) {
      const totalUpdateCount = updatedKeywords.reduce((acc, k) => acc + k.updateCount, 0)

      // 1. Telegram Notification
      if (user.telegramId) {
        if (updatedKeywords.length === 1) {
          const first = updatedKeywords[0]
          sendSubscriptionNewUpdateMessage(
            env.TELE_BOT_TOKEN,
            env.TELE_MINI_APP_LINK,
            user.telegramId,
            first.keyword,
            first.updateCount,
            first.feedItems || [],
            first.miniAppLink || ''
          )
        } else {
          sendAggregatedSubscriptionNewUpdateMessage(
            env.TELE_BOT_TOKEN,
            user.telegramId,
            totalUpdateCount,
            updatedKeywords.map((k) => ({
              keyword: k.keyword,
              updateCount: k.updateCount,
              feedItems: k.feedItems,
              miniAppLink: k.miniAppLink || '',
            }))
          )
        }
      }

      // 2. Email Notification (Aggregated single email)
      if (user.email) {
        const emailParams: AggregatedNotificationParams = {
          to: user.email,
          nickname: getNickname(user.email, user.nickname || ''),
          totalUpdateCount,
          subject:
            updatedKeywords.length === 1
              ? `#${updatedKeywords[0].keyword} has new podcasts update`
              : `${totalUpdateCount} new episodes in #${updatedKeywords[0].keyword} and ${updatedKeywords.length - 1} other subscriptions`,
          keywordUpdates: updatedKeywords,
        }
        try {
          await sendAggregatedSubscriptionUpdateEmail(env, emailParams, {
            webBaseUrl: env.PORKAST_WEB_BASE_URL,
          })
        } catch (e) {
          logger.error('Send aggregated subscription update email failed', e)
        }
      }
    }

    // 3. Update latestId for subscriptions
    for (const subUpdate of subscriptionsToUpdate) {
      if (!subUpdate.id) continue
      await db
        .update(userSubscription)
        .set({
          latestId: subUpdate.latestId,
          updateTime: subUpdate.updateTime,
          totalCount: subUpdate.totalCount,
        })
        .where(eq(userSubscription.id, subUpdate.id))
    }
  } catch (error) {
    logger.error(`Failed to execute aggregated notification for user: ${user.id}`, error)
  }
}
