import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { userRouter } from './api/user/route'
import { authRouter } from './api/auth/route'
import { subscribeRouter } from './api/subscribe/route'
import { playlistRoute } from './api/playlist/route'
import { listenLaterRoute } from './api/listenlater/route'
import { rssRoute } from './api/rss/route'
import { membershipRouter } from './api/membership/route'
import { webhookRouter } from './api/webhook/route'
import { dbMiddleware } from './db/middleware'
import { handleSubscriptionUpdate } from './queues/subscription'
import { handleCron } from './crons/user_sub_update'
import teleBot from './telegram/bot.hook'
import { setupTelegramWebhook } from './telegram/bot.setup'
import { setSpotifyCredentials } from './utils/spotify'
import { setPodcastIndexCredentials } from './utils/podcast-index'
import { initItunesProxy } from './utils/itunes'
import type { Env } from './env'

const app = new Hono<{ Bindings: Env }>()

app.use(cors({
  origin: '*',
  allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests', 'Content-Type', 'Authorization'],
  allowMethods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 600,
}))

app.use('*', dbMiddleware)

app.use('*', async (c, next) => {
  setSpotifyCredentials(c.env.SPOTIFY_CLIENT_ID, c.env.SPOTIFY_CLIENT_SECRET)
  setPodcastIndexCredentials(c.env.PODCAST_INDEX_API_KEY, c.env.PODCAST_INDEX_API_SECRET)
  initItunesProxy(c.env.WEBSHARE_PROXY_URL)
  await next()
})

app.route('/api/user', userRouter)
app.route('/api/auth', authRouter)
app.route('/api/subscribe', subscribeRouter)
app.route('/api/playlist', playlistRoute)
app.route('/api/listenlater', listenLaterRoute)
app.route('/api/rss', rssRoute)
app.route('/api/membership', membershipRouter)
app.route('/api/webhook', webhookRouter)

app.route('/telegram', teleBot)

app.get('/', async (c) => {
  return c.text('Porkast Service running on Cloudflare Workers')
})

export default {
  fetch: app.fetch,
  scheduled: handleCron,
  queue: handleSubscriptionUpdate,
} satisfies ExportedHandler<Env>
