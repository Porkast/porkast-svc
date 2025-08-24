import { Hono } from "hono";
import { generateListenLaterRSSXml, generatePlaylistRSSXml, generateSubscriptionRSS } from "../../db/shared";


export const rssRoute = new Hono()

rssRoute.get('/listenlater/:userId', async (c) => {
    const userId = c.req.param('userId')
    if (!userId) {
        return c.json({
            code: 1,
            msg: 'User Id is required'
        })
    }
    try {
        const rssStr = await generateListenLaterRSSXml(userId)
        return c.body(rssStr, 200, {
            'Content-Type': 'application/rss+xml'
        });
    } catch (error) {
        console.error(`generate listenlater rss with userId ${userId} error : `, error)
        return c.json({
            code: 1,
            msg: 'Ops! Something went wrong'
        })
    }
})

rssRoute.get('playlist/:playlistId/:userId', async (c) => {
    const userId = c.req.param('userId')
    const playlistId = c.req.param('playlistId')
    if (!userId) {
        return c.json({
            code: 1,
            msg: 'User Id is required'
        })
    }
    if (!playlistId) {
        return c.json({
            code: 1,
            msg: 'Playlist Id is required'
        })
    }
    try {
        const rssStr = await generatePlaylistRSSXml(userId, playlistId)
        return c.body(rssStr, 200, {
            'Content-Type': 'application/rss+xml'
        });
    } catch (error) {
        console.error(`generate playlist rss with userId ${userId} and playlistId ${playlistId} error : `, error)
        return c.json({
            code: 1,
            msg: 'Ops! Something went wrong'
        })
    }
})

rssRoute.get('/subscription/:userId/:keyword', async (c) => {
    const userId = c.req.param('userId')
    const keyword = c.req.param('keyword')
    if (!userId) {
        return c.json({
            code: 1,
            msg: 'User Id is required'
        })
    }
    if (!keyword) {
        return c.json({
            code: 1,
            msg: 'Keyword is required'
        })
    }
    try {
        const rssStr = await generateSubscriptionRSS(userId, keyword)
        return c.body(rssStr, 200, {
            'Content-Type': 'application/rss+xml'
        });
    } catch (error) {
        console.error(`generate subscription rss with userId ${userId} and keyword ${keyword} error : `, error)
        return c.json({
            code: 1,
            msg: 'Ops! Something went wrong'
        })
    }
})