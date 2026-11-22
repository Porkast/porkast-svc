import { Hono } from 'hono'
import { createDb } from '../../db/client'
import type { Env } from '../../env'
import {
  DEFAULT_OG_METADATA,
  resolveChannelOg,
  resolveEpisodeOg,
  resolveListenLaterOg,
  resolvePlaylistOg,
  resolveSubscriptionOg,
} from './og'

export const metaRoute = new Hono<{ Bindings: Env }>()

metaRoute.get('/og', async (c) => {
  const type = (c.req.query('type') || '').trim().toLowerCase()
  const channelId = c.req.query('channelId') || ''
  const episodeId = c.req.query('episodeId') || ''
  const search = c.req.query('search') || ''
  const userRef = c.req.query('userRef') || ''
  const keyword = c.req.query('keyword') || ''
  const playlistId = c.req.query('playlistId') || ''

  const db = createDb(c.env.DB)
  let data = DEFAULT_OG_METADATA

  try {
    switch (type) {
      case 'channel':
        data = await resolveChannelOg(db, channelId)
        break
      case 'episode':
        data = await resolveEpisodeOg(db, channelId, episodeId, search)
        break
      case 'subscription':
        data = await resolveSubscriptionOg(db, userRef, keyword)
        break
      case 'listenlater':
        data = await resolveListenLaterOg(db, userRef)
        break
      case 'playlist':
        data = await resolvePlaylistOg(db, userRef, playlistId)
        break
      default:
        data = DEFAULT_OG_METADATA
        break
    }
  } catch {
    data = DEFAULT_OG_METADATA
  }

  return c.json(
    {
      code: 0,
      msg: 'OK',
      data,
    },
    200,
    {
      'Cache-Control': 'public, max-age=1800, s-maxage=1800',
    }
  )
})
