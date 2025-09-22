import { Hono } from "hono"
import { zValidator } from '@hono/zod-validator';
import { UserSyncRequestData, UserSyncSchema } from "./types";
import { getUserInfoByTelegramId } from "../../db/user";
import { syncUserData } from "./user";

export const userRouter = new Hono()

userRouter.get('/tele_id/:id', async (c) => {
    const telegramId = c.req.param('id')
    const userInfo = await getUserInfoByTelegramId(telegramId)

    return c.json({
        code: 0,
        msg: 'Success',
        data: userInfo
    })
})

userRouter.post('/sync', zValidator('json', UserSyncSchema), async (c) => {

    const request: UserSyncRequestData = await c.req.json();
    try {
        await syncUserData(request)
    } catch (error) {
        return c.json({
            code: 1,
            msg: error
        })
    }
    return c.json({
        code: 0,
        msg: 'Success'
    })
})
