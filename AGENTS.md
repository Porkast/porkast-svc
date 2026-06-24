# Porkast Service - Context Documentation

## Project Overview

Porkast Service is a Cloudflare Workers backend service providing podcast subscription management, notifications, and RSS feed processing. The project uses the Hono framework to build REST APIs, integrated with Telegram bot, email notifications, and Cloudflare Queues/Cron Triggers for async processing.

### Tech Stack

- **Runtime**: Cloudflare Workers (with `nodejs_compat`)
- **Language**: TypeScript
- **Web Framework**: Hono
- **Database**: Cloudflare D1 (SQLite via Drizzle ORM)
- **Async Processing**: Cloudflare Queues + Cron Triggers
- **Key Dependencies**:
  - Hono (HTTP framework)
  - Drizzle ORM (database ORM)
  - Resend (email service)
  - rss-parser (RSS parsing)
  - podcast (podcast processing)
  - hogan.js (email templates)

## Project Structure

```txt
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

- Cloudflare Cron Trigger runs every hour
- Handler is located in `src/crons/user_sub_update.ts`
- Enqueues subscription update messages to `porkast-sub-update` Queue

### Queues

- Consumer handler: `src/queues/subscription.ts`
- Processes subscription updates asynchronously
- Fetches new episodes from iTunes/Spotify, stores in D1, notifies users via Telegram/Email

## Environment Configuration

### Cloudflare Secrets (production)

```bash
npx wrangler secret put TELE_BOT_TOKEN
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SPOTIFY_CLIENT_ID
npx wrangler secret put SPOTIFY_CLIENT_SECRET
```

### .dev.vars (local development)

```bash
TELE_BOT_TOKEN="your_telegram_bot_token"
BOT_WEBHOOK_URL="your_webhook_url"
RESEND_API_KEY="your_resend_api_key"
SPOTIFY_CLIENT_ID="your_spotify_client_id"
SPOTIFY_CLIENT_SECRET="your_spotify_client_secret"
```

### Wrangler vars (configured in `wrangler.jsonc`)

```bash
PORKAST_WEB_BASE_URL="https://porkast.com"
TELE_MINI_APP_LINK="https://porkast-tele-mini-app.guoshaotech.workers.dev"
NODE_ENV="production"
```

## Deployment

### Cloudflare Workers

```bash
# Deploy
bun run deploy

# Set secrets for production
npx wrangler secret put TELE_BOT_TOKEN
npx wrangler secret put RESEND_API_KEY

# View logs (observability)
npx wrangler tail
```

### Before Deploying

1. Run `bun run typecheck` to catch type errors
2. Verify D1 migrations are up to date with `bun run db:generate`

## Infrastructure Bindings

| Binding | Type | Purpose |
|---|---|---|
| `DB` | D1 Database | Primary data store (Drizzle ORM) |
| `TELEGRAM_STATE` | KV Namespace | Telegram bot conversation state |
| `SUB_UPDATE_QUEUE` | Queue | Async subscription processing |

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
- Tier-based keyword limits

### 7. Telegram Bot (`src/telegram/`)

- Podcast search and subscription
- Update notifications
- Interactive commands and inline keyboards

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
- `user_membership`: App Store subscription records
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
