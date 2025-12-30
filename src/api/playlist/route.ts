import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { AddPodcastToPlaylistRequestData, AddPodcastToPlaylistSchema, CreatePlaylistRequestData, CreatePlaylistSchema } from "./types";
import { addPodcastToPlaylist, createPlaylist, getPlaylistById, getPlaylistPodcastList, getUserPlaylistList } from "./playlist";
import { DEFAULT_PODCAST_SOURCE } from "../../models/types";


export const playlistRoute = new Hono()

playlistRoute.post('', zValidator('json', CreatePlaylistSchema), async (c) => {

    const body: CreatePlaylistRequestData = await c.req.json();
    const message = await createPlaylist(body.userId, body.playlistName, body.description || '')

    return c.json({
        code: 0,
        msg: message
    })
})

playlistRoute.get('/list/:userId', async (c) => {

    const userId = c.req.param('userId')
    const limit = c.req.query('limit') || '10'
    const offset = c.req.query('offset') || '0'
    if (!userId) {
        return c.json({
            code: 1,
            msg: 'User Id is required'
        })
    }
    const data = await getUserPlaylistList(userId, limit, offset)
    return c.json({
        code: 0,
        msg: 'Success',
        data: data
    })
})

playlistRoute.get('/list/:userId/:playlistId', async (c) => {
    const userId = c.req.param('userId')
    const playlistId = c.req.param('playlistId')
    const limit = c.req.query('limit') || '10'
    const offset = c.req.query('offset') || '0'
    if (!userId) {
        return c.json({
            code: 1,
            msg: 'User Id is required'
        })
    }
    const data = await getPlaylistPodcastList(userId, playlistId, limit, offset)
    return c.json({
        code: 0,
        msg: 'Success',
        data: data.playlist
    })
})

playlistRoute.get('/:playlistId', async (c) => {
    const playlistId = c.req.param('playlistId')
    if (!playlistId) {
        return c.json({
            code: 1,
            msg: 'Playlist Id is required'
        })
    }
    const data = await getPlaylistById(playlistId)
    if (!data) {
        return c.json({
            code: 1,
            msg: 'Playlist not found'
        })
    }
    return c.json({
        code: 0,
        msg: 'Success',
        data: {
            ...data.playlist,
            UserInfo: data.userInfo
        }
    })
})

playlistRoute.post('/item', zValidator('json', AddPodcastToPlaylistSchema), async (c) => {

    const body: AddPodcastToPlaylistRequestData = await c.req.json();
    try {
        const message = await addPodcastToPlaylist(body.playlistId, body.channelId, body.source || DEFAULT_PODCAST_SOURCE, body.guid)
        return c.json({
            code: 0,
            msg: message
        })
    } catch (error: Error | any) {
        return c.json({
            code: 1,
            msg: error.message
        })
    }

})
