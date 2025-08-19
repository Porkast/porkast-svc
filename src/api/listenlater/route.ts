import { Hono } from "hono";
import { AddPodcastToListenLaterRequest } from "./types";
import { addEpisodeToListenLater, getUserListenLaterList } from "./listen_later";
import { UserListenLaterDto } from "../../models/listen_later";

export const listenLaterRoute = new Hono()

listenLaterRoute.post('', async (c) => {
    
    const body: AddPodcastToListenLaterRequest = await c.req.json();
    if (!body.source) {
        body.source = 'itunes'
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
