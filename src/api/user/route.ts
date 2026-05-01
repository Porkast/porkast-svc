import { Hono } from "hono"
import { zValidator } from '@hono/zod-validator';
import { UserSyncRequestData, UserSyncSchema } from "./types";
import { getUserInfoByTelegramId } from "../../db/user";
import { syncUserData } from "./user";
import prisma from "../../db/prisma.client";
import { getBearerToken, getSessionUser } from "../auth/auth";

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

userRouter.get('/info/:userId', async (c) => {
    const userId = c.req.param('userId')
    
    if (!userId) {
        return c.json({
            code: 1,
            msg: 'User ID is required'
        })
    }

    const queryData = await prisma.user_info.findUnique({
        where: {
            id: userId
        }
    })

    if (queryData) {
        queryData.password = ''
        return c.json({
            code: 0,
            msg: 'OK',
            data: queryData
        })
    }

    return c.json({
        code: 1,
        msg: 'User not found'
    })
})

userRouter.get('/:userId/stats', async (c) => {
    const userId = c.req.param('userId')

    if (!userId) {
        return c.json({
            code: 1,
            msg: 'User ID is required'
        })
    }

    const token = getBearerToken(c.req.header('Authorization'))
    if (!token) {
        return c.json({ code: 1, msg: 'Unauthorized' }, 401)
    }

    const user = await getSessionUser(token)
    if (!user) {
        return c.json({ code: 1, msg: 'Invalid session' }, 401)
    }

    if (user.userId !== userId) {
        return c.json({ code: 1, msg: 'Forbidden' }, 403)
    }

    const [subscriptionCount, listenLaterCount, playlistCount] = await Promise.all([
        prisma.user_subscription.count({
            where: {
                user_id: userId,
                status: 1
            }
        }),
        prisma.user_listen_later.count({
            where: {
                user_id: userId,
                status: 1
            }
        }),
        prisma.user_playlist.count({
            where: {
                user_id: userId,
                status: 1
            }
        })
    ])

    return c.json({
        code: 0,
        msg: 'OK',
        data: {
            subscriptionCount,
            listenLaterCount,
            playlistCount
        }
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
