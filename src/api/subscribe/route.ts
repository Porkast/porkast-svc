import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { KeywordSubscribeRequestData, KeywordSubscribeSchema } from "./types";
import { getUserSubscriptionList, updateUserSubscription } from "./subscribe";


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