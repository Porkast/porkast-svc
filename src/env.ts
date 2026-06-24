import type { D1Database } from '@cloudflare/workers-types'

export interface Env {
  DB: D1Database
  SUB_UPDATE_QUEUE: Queue<SubscriptionUpdateMessage>
  TELEGRAM_STATE: KVNamespace
  TELE_BOT_TOKEN: string
  BOT_WEBHOOK_URL: string
  RESEND_API_KEY: string
  SPOTIFY_CLIENT_ID: string
  SPOTIFY_CLIENT_SECRET: string
  PODCAST_INDEX_API_KEY: string
  PODCAST_INDEX_API_SECRET: string
  PORKAST_WEB_BASE_URL: string
  TELE_MINI_APP_LINK: string
  DEMO_EMAILS: string
  DEMO_CODE: string
  NODE_ENV: string
}

export interface SubscriptionUpdateMessage {
  userId: string
  keyword: string
  country: string
  source: string
  excludeFeedId: string
  subscriptionId: string
  latestId: number
}
