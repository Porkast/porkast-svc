import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { AddPodcastToPlaylistRequestData, AddPodcastToPlaylistSchema, CreatePlaylistRequestData, CreatePlaylistSchema } from "./types";
import { addPodcastToPlaylist, createPlaylist } from "./playlist";


export const playlistRoute = new Hono()

playlistRoute.post('', zValidator('json', CreatePlaylistSchema), async (c) => {

    const body: CreatePlaylistRequestData = await c.req.json();
    const message = await createPlaylist(body.userId, body.playlistName, body.description || '')

    return c.json({
        code: 0,
        msg: message
    })
})

playlistRoute.post('/item', zValidator('json', AddPodcastToPlaylistSchema), async (c) => {

    const body: AddPodcastToPlaylistRequestData = await c.req.json();
    try {
        const message = await addPodcastToPlaylist(body.playlistId, body.channelId, body.source || 'itunes', body.guid)
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
