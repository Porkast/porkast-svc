import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { RecordListenHistoryRequest, RecordListenHistorySchema } from "./types";
import { recordEpisodeListenHistory, getUserListenHistory, removeEpisodeFromListenHistory } from "./history";
import { UserListenHistoryDto } from "../../db/history";
import { DEFAULT_PODCAST_SOURCE } from "../../models/types";
import type { Env } from '../../env'
import { createDb } from '../../db/client'

export const historyRoute = new Hono<{ Bindings: Env }>()

historyRoute.post('', zValidator('json', RecordListenHistorySchema), async (c) => {
    const db = createDb(c.env.DB)
    const body: RecordListenHistoryRequest = c.req.valid('json');
    if (!body.source) {
        body.source = DEFAULT_PODCAST_SOURCE
    }

    try {
        await recordEpisodeListenHistory(db, body)
    } catch (error: Error | any) {
        return c.json({
            code: 1,
            msg: error.message
        })
    }

    return c.json({
        code: 0,
        msg: 'Success'
    })
})

historyRoute.get('/list/:userId', async (c) => {
    const db = createDb(c.env.DB)
    const userId = c.req.param('userId')
    const limit = c.req.query('limit') || '10'
    const offset = c.req.query('offset') || '0'
    if (!userId) {
        return c.json({
            code: 1,
            msg: 'User Id is required'
        })
    }

    let userHistoryList: UserListenHistoryDto[]
    try {
        userHistoryList = await getUserListenHistory(db, userId, Number(limit), Number(offset))
    } catch (error: Error | any) {
        return c.json({
            code: 1,
            msg: error.message
        })
    }

    return c.json({
        code: 0,
        msg: 'Success',
        data: userHistoryList
    })
})

historyRoute.delete('/:userId/:itemId', async (c) => {
    const db = createDb(c.env.DB)
    const userId = c.req.param('userId')
    const itemId = c.req.param('itemId')
    if (!userId || !itemId) {
        return c.json({
            code: 1,
            msg: 'User Id and Item Id are required'
        })
    }
    try {
        await removeEpisodeFromListenHistory(db, userId, itemId)
    } catch (error: Error | any) {
        return c.json({
            code: 1,
            msg: error.message
        })
    }
    return c.json({
        code: 0,
        msg: 'Removed'
    })
})
