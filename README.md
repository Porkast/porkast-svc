# Porkast Service

A Cloudflare Workers backend service for Porkast providing podcast subscription management, notifications, and feed processing.

## Features

- Podcast subscription management
- Telegram bot integration
- Email notifications via Resend
- Scheduled cron jobs for feed updates
- Cloudflare Queues for subscription updates
- D1 database with Drizzle ORM
- iTunes & Spotify API integration

## Prerequisites

- [Bun](https://bun.sh/) (v1.0.0 or later)
- [Cloudflare account](https://dash.cloudflare.com/)
- Wrangler CLI (included via devDependencies)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/Porkast/porkast-svc.git
cd porkast-svc
```

2. Install dependencies:

```bash
bun install
```

3. Set up environment variables:

Edit the `.dev.vars` file with your secrets:

```bash
TELE_BOT_TOKEN="your_telegram_bot_token"
RESEND_API_KEY="your_resend_api_key"
SPOTIFY_CLIENT_ID="your_spotify_client_id"
SPOTIFY_CLIENT_SECRET="your_spotify_client_secret"
```

4. Run database migrations:

```bash
bun run db:generate
bun run db:migrate
```

## Running the Service

Development mode (with hot reload via Wrangler):

```bash
bun run dev
```

## Deployment

Deploy to Cloudflare Workers:

```bash
bun run deploy
```

Set production secrets:

```bash
npx wrangler secret put TELE_BOT_TOKEN
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SPOTIFY_CLIENT_ID
npx wrangler secret put SPOTIFY_CLIENT_SECRET
```

## TypeScript Type Checking

```bash
bun run typecheck
```

## Testing

```bash
bun test
```

## Project Structure

```
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
├── scripts/              # Data migration scripts
├── telegram/             # Telegram bot handlers
├── templates/            # Email templates (Hogan.js)
└── utils/                # Utility functions
```

## Infrastructure

The service runs on Cloudflare Workers with the following bindings:

- **D1 Database**: `porkast-db` (SQLite via Drizzle ORM)
- **KV Namespace**: `TELEGRAM_STATE` (Telegram bot state management)
- **Queue**: `porkast-sub-update` (Async subscription processing)
- **Cron Trigger**: Hourly subscription update check
- **Compatibility Flags**: `nodejs_compat`

## Environment Variables (Cloudflare Secrets)

| Variable | Description |
|---|---|
| `TELE_BOT_TOKEN` | Telegram bot token |
| `BOT_WEBHOOK_URL` | Telegram webhook URL |
| `RESEND_API_KEY` | Resend email API key |
| `SPOTIFY_CLIENT_ID` | Spotify API client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify API client secret |
| `PORKAST_WEB_BASE_URL` | Frontend base URL |
| `TELE_MINI_APP_LINK` | Telegram Mini App link |

## Main Functional Modules

### 1. User Management (`src/api/user/`)
- User registration and authentication (email OTP)
- Session management

### 2. Subscription Management (`src/api/subscribe/`)
- Keyword-based podcast subscriptions
- Subscription update notifications (Telegram + Email)
- Cloudflare Queue for async processing

### 3. Playlists (`src/api/playlist/`)
- Create and manage playlists
- Add podcast items to playlists

### 4. Listen Later (`src/api/listenlater/`)
- Save podcast items for later listening

### 5. RSS Subscriptions (`src/api/rss/`)
- RSS feed management
- Podcast content updates

### 6. Membership (`src/api/membership/`)
- App Store subscription verification
- Tier-based keyword limits

### 7. Telegram Bot (`src/telegram/`)
- Podcast search and subscription
- Update notifications
- Interactive inline keyboards

## Development Notes

1. **Database Migrations**: After modifying the Drizzle schema, run `bun run db:generate`
2. **Type Checking**: Run `bun run typecheck` before committing to catch type errors
3. **Secrets**: Use `.dev.vars` for local development, `wrangler secret put` for production
4. **Logging**: Observability logging is enabled in production via Wrangler

## License

[MIT](https://choosealicense.com/licenses/mit/)
