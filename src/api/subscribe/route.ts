import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { KeywordSubscribeRequestData, KeywordSubscribeSchema } from "./types";
import { getUserSubscriptionList, updateUserSubscription } from "./subscribe";
import { queryKeywordSubscriptionFeedItemList, queryUserKeywordSubscriptionDetail, disableUserKeywordSubscription } from "../../db/subscription";


export const subscribeRouter = new Hono()

subscribeRouter.post('/keyword', zValidator('json', KeywordSubscribeSchema), async (c) => {
    const request: KeywordSubscribeRequestData = await c.req.json();
    const message = await updateUserSubscription(request)

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
    const data = await getUserSubscriptionList(userId, limit, offset)

    return c.json({
        code: 0,
        msg: 'Success',
        data: data
    })
})

subscribeRouter.get('/:userId/:keyword', async (c) => {
    const userId = c.req.param('userId');
    const keyword = decodeURIComponent(c.req.param('keyword'));
    const page = c.req.query('page') || '1';
    const limit = 10;
    const offset = (Number(page) - 1) * limit;

    let usInfo;
    try {
        usInfo = await queryUserKeywordSubscriptionDetail(userId, keyword);
    } catch (error) {
        return c.json({
            code: 1,
            msg: String(error)
        });
    }

    const [feedItemList] = await queryKeywordSubscriptionFeedItemList(
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

    try {
        const success = await disableUserKeywordSubscription(userId, keyword);
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