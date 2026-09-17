# Porkast Service - Context Documentation

## Project Overview

Porkast Service is a Cloudflare Workers backend service providing podcast subscription management, notifications, and RSS feed processing. The project uses the Hono framework to build REST APIs, integrated with Telegram bot, email notifications, and Cloudflare Queues/Cron Triggers for async processing.

### Tech Stack

- **Runtime**: Cloudflare Workers (with `nodejs_compat`)
- **Language**: TypeScript
- **Web Framework**: Hono
- **Database**: Cloudflare D1 (SQLite via Drizzle ORM)
- **Async Processing**: Cloudflare Queues + Cron Triggers
- **Containers**: Cloudflare Workers Containers (iTunes API proxy)
- **Key Dependencies**:
  - Hono (HTTP framework)
  - Drizzle ORM (database ORM)
  - Resend (email service)
  - rss-parser (RSS parsing)
  - podcast (podcast processing)
  - hogan.js (email templates)
  - undici (container HTTP proxy agent)

## Project Structure

```txt
containers/
└── itunes-proxy/         # iTunes API proxy container (Bun + Docker)
src/
├── index.ts              # Main application entry point
├── env.ts                # Environment type definitions
├── api/                  # API routes
│   ├── auth/             # Authentication
│   ├── listenlater/      # Listen later functionality
│   ├── membership/       # Membership & subscription tiers
│   ├── playlist/         # Playlist functionality
│   ├── rss/              # RSS subscriptions
│   ├── subscribe/        # Subscription management
│   ├── user/             # User management
│   └── webhook/          # App Store webhook
├── containers/           # Container class definitions
│   └── itunes-proxy.ts   # ItunesProxyContainer (Durable Object Container)
├── crons/                # Cron job handlers
├── db/                   # Database schema & queries (Drizzle ORM)
├── email/                # Email services (Resend)
├── models/               # Data models & types
├── queues/               # Queue consumer handlers
├── scripts/              # Data migration scripts (PG → D1)
├── telegram/             # Telegram bot handlers
├── templates/            # Email templates (Hogan.js)
└── utils/                # Utility functions
```

## Building and Running

### Development Environment

```bash
# Install dependencies
bun install

# Run database migrations (D1)
bun run db:generate && bun run db:migrate

# Development mode (Wrangler dev with hot reload)
bun run dev
```

### Production Environment

```bash
# Type check
bun run typecheck

# Deploy to Cloudflare Workers
bun run deploy
```

### Testing

```bash
bun test
```

## Development Conventions

### Code Style

- Use TypeScript strict mode
- Follow Hono framework routing patterns
- Use Drizzle ORM for database operations
- Use Zod for data validation

### API Structure

- All API routes are located in the `src/api/` directory
- Each functional module includes: route files, business logic files, type definition files, and test files
- Use `@hono/zod-validator` for request validation

### Git Commit & Push

- Every `git commit` and `git push` requires explicit user approval before execution
- Approval must be obtained fresh each time — previous approval in the same session does not carry over
- Before requesting approval, show the user `git diff --stat` and `git diff` (or a summary) so they can review what will be committed

### Database Schema

- Use Drizzle ORM schema definitions in `src/db/schema.ts`
- All tables use the `public` (default) SQLite schema
- Main entities: users, podcast feeds, podcast items, subscriptions, playlists, memberships

### Telegram Bot

- Bot code is located in the `src/telegram/` directory
- Uses Cloudflare KV (`TELEGRAM_STATE`) for state management
- Supports podcast subscription, search, and notification features
- Sends messages using HTML format

### Scheduled Tasks

- Cloudflare Cron Trigger runs every 3 hours
- Handler is located in `src/crons/user_sub_update.ts`
- Enqueues subscription update messages to `porkast-sub-update` Queue

### Queues

- Consumer handler: `src/queues/subscription.ts`
- Processes subscription updates asynchronously
- Fetches new episodes from iTunes/Spotify (via iTunes proxy), stores in D1, notifies users via Telegram/Email

## Environment Configuration

### Cloudflare Secrets (production)

```bash
npx wrangler secret put TELE_BOT_TOKEN
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SPOTIFY_CLIENT_ID
npx wrangler secret put SPOTIFY_CLIENT_SECRET
npx wrangler secret put DODO_PAYMENTS_API_KEY
npx wrangler secret put DODO_PAYMENTS_WEBHOOK_KEY
```

### .dev.vars (local development)

```bash
TELE_BOT_TOKEN="your_telegram_bot_token"
BOT_WEBHOOK_URL="your_webhook_url"
RESEND_API_KEY="your_resend_api_key"
SPOTIFY_CLIENT_ID="your_spotify_client_id"
SPOTIFY_CLIENT_SECRET="your_spotify_client_secret"
WEBSHARE_PROXY_URL="your_webshare_proxy_url"
ITUNES_PROXY_BASE_URL="http://localhost:8080"
DODO_PAYMENTS_API_KEY="your_dodo_test_mode_api_key"
DODO_PAYMENTS_WEBHOOK_KEY="your_dodo_test_mode_webhook_signing_key"
DODO_ENVIRONMENT="test_mode"
DODO_PRODUCT_PRO="your_test_mode_pro_product_id"
DODO_PRODUCT_UNLIMITED="your_test_mode_unlimited_product_id"
```

### Wrangler vars (configured in `wrangler.jsonc`)

```bash
PORKAST_WEB_BASE_URL="https://porkast.com"
TELE_MINI_APP_LINK="https://porkast-tele-mini-app.guoshaotech.workers.dev"
NODE_ENV="production"
DODO_ENVIRONMENT="live_mode"
DODO_PRODUCT_PRO="pdt_0Nnnq6wc4Jv3YgYJI9VtM"
DODO_PRODUCT_UNLIMITED="pdt_0Nnnq6pxaa0bH2MDmiSGW"
```

### Dodo Payments modes

- Production runs `DODO_ENVIRONMENT=live_mode` with live product IDs and live API/webhook secrets.
- Local development must set `DODO_ENVIRONMENT=test_mode` in `.dev.vars` (test API key, test webhook key, test product IDs). Test keys are prefixed `dodo_test_` and only work against `https://test.dodopayments.com`; live keys against `https://live.dodopayments.com`.
- Live webhook endpoint: `https://api.porkast.com/api/membership/webhook/dodo` (managed in the Dodo dashboard under Developer → Webhooks). It must subscribe to `subscription.*` and `payment.*` events. Test mode has its own separate webhook endpoint and signing key.
- Switching modes requires updating `DODO_ENVIRONMENT`, both product IDs, and both Cloudflare secrets — the SDK defaults to live mode if `DODO_ENVIRONMENT` is missing.

## Deployment

### Cloudflare Workers

```bash
# Deploy
bun run deploy

# Set secrets for production
npx wrangler secret put TELE_BOT_TOKEN
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SPOTIFY_CLIENT_ID
npx wrangler secret put SPOTIFY_CLIENT_SECRET
npx wrangler secret put WEBSHARE_PROXY_URL
npx wrangler secret put DODO_PAYMENTS_API_KEY
npx wrangler secret put DODO_PAYMENTS_WEBHOOK_KEY

# View logs (observability)
npx wrangler tail
```

### Before Deploying

1. Run `bun run typecheck` to catch type errors
2. Verify D1 migrations are up to date with `bun run db:generate`
3. Container images are built automatically by `wrangler deploy` (see `containers` config in `wrangler.jsonc`)

## Infrastructure Bindings

| Binding | Type | Purpose |
|---|---|---|---|
| `DB` | D1 Database | Primary data store (Drizzle ORM) |
| `TELEGRAM_STATE` | KV Namespace | Telegram bot conversation state |
| `SUB_UPDATE_QUEUE` | Queue | Async subscription processing |
| `ITUNES_PROXY` | Durable Object Container | iTunes API proxy (rate-limit avoidance) |

## Main Functional Modules

### 1. User Management (`src/api/user/`)

- User registration and authentication (email OTP)
- User information management

### 2. Subscription Management (`src/api/subscribe/`)

- Podcast subscriptions via keyword
- Keyword subscriptions
- Subscription update notifications (Telegram + Email)

### 3. Playlists (`src/api/playlist/`)

- Create and manage playlists
- Add podcast items to playlists

### 4. Listen Later (`src/api/listenlater/`)

- Save podcast items for later listening

### 5. RSS Subscriptions (`src/api/rss/`)

- RSS feed management
- Podcast content updates

### 6. Membership (`src/api/membership/`)

- App Store subscription verification and sync
- Dodo Payments web subscriptions: checkout (`POST /checkout`), customer portal (`POST /portal`), webhook sync (`POST /webhook/dodo`)
- Tier-based keyword limits

### 7. Telegram Bot (`src/telegram/`)

- Podcast search and subscription
- Update notifications
- Interactive commands and inline keyboards

### 8. iTunes API Proxy (`containers/itunes-proxy/` + `src/containers/`)

- Cloudflare Workers Container proxying `itunes.apple.com` search/lookup API
- Runs a Bun HTTP server (`Dockerfile`) with `/search`, `/lookup`, `/health` endpoints
- Routes through a Webshare proxy (`WEBSHARE_PROXY_URL`) to avoid rate limiting
- Three operational modes: standalone container (prod), external URL (dev), or direct fetch (fallback)
- Configured via `ITUNES_PROXY_BASE_URL` (standalone URL) or `ITUNES_PROXY` (DO binding)
- Container class: `ItunesProxyContainer` in `src/containers/itunes-proxy.ts` (auto-sleeps after 30m idle)

## Database Relationships

Core data tables (D1/Drizzle):

- `user_info`: User basic information
- `user_subscription`: User subscriptions by keyword
- `feed_channel`: Podcast channels
- `feed_item`: Podcast episodes/items
- `keyword_subscription`: Links keywords to feed items
- `user_playlist`: User playlists
- `user_playlist_item`: Playlist items
- `user_listen_later`: Listen later list
- `user_membership`: App Store and Dodo subscription records
- `app_session`: Authentication sessions
- `verification_token`: Email OTP tokens

## Development Notes

1. **Database Migrations**: After modifying `src/db/schema.ts`, run `bun run db:generate`
2. **Type Checking**: Run `bun run typecheck` before committing — `tsc --noEmit` catches type errors the runtime would miss
3. **Environment Variables**: Use `.dev.vars` for local dev, `wrangler secret put` for production
4. **API Testing**: Each functional module has corresponding test files
5. **Logging**: Use `src/utils/logger.ts` for logging
6. **Error Handling**: Follow unified error handling patterns

## Common Commands

```bash
# Type check
bun run typecheck

# Generate Drizzle migrations
bun run db:generate

# Apply Drizzle migrations
bun run db:migrate

# D1 database studio (local)
npx wrangler d1 execute porkast-db --local --command="SELECT * FROM user_info LIMIT 10"

# Tail production logs
npx wrangler tail

# View deployment
npx wrangler deployments
```
