import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { eq } from 'drizzle-orm'
import { KeywordSubscribeRequestData, KeywordSubscribeSchema } from "./types";
import { getUserSubscriptionEpisodeList, getUserSubscriptionList, updateUserSubscription } from "./subscribe";
import { disableUserKeywordSubscription, queryKeywordSubscriptionFeedItemList, queryUserKeywordSubscriptionDetail } from "../../db/subscription";
import { createDb } from "../../db/client";
import { userSubscription } from '../../db/schema'
import { setSpotifyCredentials } from '../../utils/spotify'
import { setPodcastIndexCredentials } from '../../utils/podcast-index'
import { initItunesProxy } from '../../utils/itunes'
import type { Env, SubscriptionUpdateMessage } from "../../env";

export const subscribeRouter = new Hono<{ Bindings: Env }>()

subscribeRouter.post('/keyword', zValidator('json', KeywordSubscribeSchema), async (c) => {
    const request: KeywordSubscribeRequestData = await c.req.json();
    const db = createDb(c.env.DB)
    const message = await updateUserSubscription(db, request)

    return c.json({
        code: 0,
        msg: message
    })
})

subscribeRouter.get('/list', async (c) => {
    const userId = c.req.query('userId')
    const limit = c.req.query('limit') || '10'
    const offset = c.req.query('offset') || '0'
    if (!userId) {
        return c.json({
            code: 1,
            msg: 'User Id is required'
        })
    }
    const db = createDb(c.env.DB)
    const data = await getUserSubscriptionList(db, userId, limit, offset)

    return c.json({
        code: 0,
        msg: 'Success',
        data: data
    })
})

subscribeRouter.get('/episodes/:userId', async (c) => {
    const userId = c.req.param('userId');
    const limit = c.req.query('limit') || '10';
    const offset = c.req.query('offset') || '0';

    if (!userId) {
        return c.json({
            code: 1,
            msg: 'User Id is required'
        });
    }

    const db = createDb(c.env.DB)
    const feedItemList = await getUserSubscriptionEpisodeList(
        db,
        userId,
        limit,
        offset
    );

    return c.json({
        code: 0,
        msg: 'Success',
        data: feedItemList
    });
});

subscribeRouter.get('/:userId/:keyword', async (c) => {
    const userId = c.req.param('userId');
    const keyword = decodeURIComponent(c.req.param('keyword'));
    const page = c.req.query('page') || '1';
    const limit = 10;
    const offset = (Number(page) - 1) * limit;

    const db = createDb(c.env.DB)
    let usInfo;
    try {
        usInfo = await queryUserKeywordSubscriptionDetail(db, userId, keyword);
    } catch (error) {
        return c.json({
            code: 1,
            msg: String(error)
        });
    }

    const [feedItemList] = await queryKeywordSubscriptionFeedItemList(
        db,
        userId,
        keyword,
        usInfo.Source,
        usInfo.Country,
        usInfo.ExcludeFeedId,
        offset,
        limit
    );

    return c.json({
        code: 0,
        msg: 'Success',
        data: feedItemList
    });
});

subscribeRouter.delete('/:userId/:keyword', async (c) => {
    const userId = c.req.param('userId');
    const keyword = decodeURIComponent(c.req.param('keyword'));

    const resp = {
        code: 0,
        message: '',
        data: null
    };

    const db = createDb(c.env.DB)
    try {
        const success = await disableUserKeywordSubscription(db, userId, keyword);
        if (success) {
            resp.code = 0;
            resp.message = 'Subscription successfully disabled';
        } else {
            resp.code = 1;
            resp.message = 'No active subscription found for this keyword';
        }
    } catch (error) {
        console.error('Error disabling user keyword subscription:', error);
        resp.code = 1;
        resp.message = 'Failed to disable subscription: ' + String(error);
    }

    return c.json(resp);
});

subscribeRouter.post('/trigger-update', async (c) => {
  setSpotifyCredentials(c.env.SPOTIFY_CLIENT_ID, c.env.SPOTIFY_CLIENT_SECRET)
  setPodcastIndexCredentials(c.env.PODCAST_INDEX_API_KEY, c.env.PODCAST_INDEX_API_SECRET)
  initItunesProxy(c.env)

  const db = createDb(c.env.DB)
  const subscriptions = await db.select().from(userSubscription).where(eq(userSubscription.status, 1))

  const messages: SubscriptionUpdateMessage[] = subscriptions.map(sub => ({
    userId: sub.userId || '',
    keyword: sub.keyword || '',
    country: sub.country || '',
    source: sub.source || '',
    excludeFeedId: sub.excludeFeedId || '',
    subscriptionId: sub.id,
    latestId: sub.latestId || 0,
  }))

  for (let i = 0; i < messages.length; i += 100) {
    await c.env.SUB_UPDATE_QUEUE.sendBatch(
      messages.slice(i, i + 100).map(body => ({ body }))
    )
  }

  return c.json({ code: 0, msg: `Enqueued ${messages.length} subscription updates` })
})
