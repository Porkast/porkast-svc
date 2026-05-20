import { Hono } from "hono"
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql } from 'drizzle-orm';
import { UserSyncRequestData, UserSyncSchema } from "./types";
import { getUserInfoByTelegramId } from "../../db/user";
import { syncUserData } from "./user";
import { getBearerToken, getSessionUser } from "../auth/auth";
import { userInfo, userSubscription, userListenLater, userPlaylist } from "../../db/schema";
import { createDb } from "../../db/client";
import type { Env } from "../../env";

export const userRouter = new Hono<{ Bindings: Env }>()

userRouter.get('/tele_id/:id', async (c) => {
    const telegramId = c.req.param('id')
    const db = createDb(c.env.DB)
    const user = await getUserInfoByTelegramId(db, telegramId)

    return c.json({
        code: 0,
        msg: 'Success',
        data: user
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

    const db = createDb(c.env.DB)
    const queryData = await db
        .select()
        .from(userInfo)
        .where(eq(userInfo.id, userId))
        .limit(1)

    if (queryData.length > 0) {
        return c.json({
            code: 0,
            msg: 'OK',
            data: { ...queryData[0], password: '' }
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

    const user = await getSessionUser(c.env, token)
    if (!user) {
        return c.json({ code: 1, msg: 'Invalid session' }, 401)
    }

    if (user.userId !== userId) {
        return c.json({ code: 1, msg: 'Forbidden' }, 403)
    }

    const db = createDb(c.env.DB)
    const [subscriptionCount, listenLaterCount, playlistCount] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(userSubscription).where(and(eq(userSubscription.userId, userId), eq(userSubscription.status, 1))).then(r => Number(r[0]?.count || 0)),
        db.select({ count: sql<number>`COUNT(*)` }).from(userListenLater).where(and(eq(userListenLater.userId, userId), eq(userListenLater.status, 1))).then(r => Number(r[0]?.count || 0)),
        db.select({ count: sql<number>`COUNT(*)` }).from(userPlaylist).where(and(eq(userPlaylist.userId, userId), eq(userPlaylist.status, 1))).then(r => Number(r[0]?.count || 0)),
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
        const db = createDb(c.env.DB)
        await syncUserData(db, request)
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
