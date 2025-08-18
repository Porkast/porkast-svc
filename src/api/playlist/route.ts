import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { CreatePlaylistRequestData, CreatePlaylistSchema } from "./types";
import { createPlaylist } from "./playlist";


export const playlistRoute = new Hono()

playlistRoute.post('', zValidator('json', CreatePlaylistSchema), async (c) => {

    const body: CreatePlaylistRequestData = await c.req.json();
    const message = await createPlaylist(body.userId, body.playlistName, body.description || '')
    
    return c.json({
        code: 0,
        msg: message
    })
})
