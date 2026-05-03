import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { AddPodcastToListenLaterRequest, AddPodcastToListenLaterSchema } from "./types";
import { addEpisodeToListenLater, getUserListenLaterList, removeEpisodeFromListenLater } from "./listen_later";
import { UserListenLaterDto } from "../../models/listen_later";
import { DEFAULT_PODCAST_SOURCE } from "../../models/types";

export const listenLaterRoute = new Hono()

listenLaterRoute.post('', zValidator('json', AddPodcastToListenLaterSchema), async (c) => {
    
    const body: AddPodcastToListenLaterRequest = c.req.valid('json');
    if (!body.source) {
        body.source = DEFAULT_PODCAST_SOURCE
    }

    try {
        await addEpisodeToListenLater(body)
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

listenLaterRoute.get('/list/:userId', async (c) => {
    
    const userId = c.req.param('userId')
    const limit = c.req.query('limit') || '10'
    const offset = c.req.query('offset') || '0'
    if (!userId) {
        return c.json({
            code: 1,
            msg: 'User Id is required'
        })
    }

    let userListenLaterList: UserListenLaterDto[]
    try {
        userListenLaterList = await getUserListenLaterList(userId, Number(limit), Number(offset))
    } catch (error: Error | any) {
        return c.json({
            code: 1,
            msg: error.message
        })
        
    }

    return c.json({
        code: 0,
        msg: 'Success',
        data: userListenLaterList
    })
})

listenLaterRoute.delete('/:userId/:itemId', async (c) => {
    const userId = c.req.param('userId')
    const itemId = c.req.param('itemId')
    if (!userId || !itemId) {
        return c.json({
            code: 1,
            msg: 'User Id and Item Id are required'
        })
    }
    try {
        await removeEpisodeFromListenLater(userId, itemId)
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
