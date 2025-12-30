# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

```bash
# Development
bun run dev                    # Start dev server with hot reload (uses bun --hot)
bun run start                  # Start production server

# Database
bunx prisma migrate dev        # Run migrations in dev
bunx prisma generate           # Generate Prisma client

# Testing
bun test                       # Run all tests
bun test <file>                # Run specific test file
```

## Project Architecture

### Framework
- **Hono** - Web framework for the API routes
- **Bun** - Runtime and package manager
- **Prisma** - ORM for PostgreSQL
- **Zod** - Request validation with `@hono/zod-validator`

### Directory Structure

```
src/
├── index.ts              # Main entry, mounts all routes and initializes bots/jobs
├── api/                  # API routes (Hono route modules)
│   ├── [module]/         # Each feature module has route.ts, types.ts, and business logic
│   │   ├── route.ts      # Hono routes using zValidator for request validation
│   │   ├── types.ts      # Zod schemas and inferred types
│   │   └── *.ts          # Business logic functions
│   ├── user/
│   ├── subscribe/
│   ├── playlist/
│   ├── listenlater/
│   └── rss/
├── db/                   # Database layer
│   ├── prisma.client.ts  # Singleton Prisma client with connection pooling
│   ├── *.ts              # Database query functions
│   └── shared.ts         # Shared DB utilities
├── models/               # DTOs and data models
├── utils/                # Utilities (logger, itunes, spotify, etc.)
├── telegram/             # Telegram bot handlers and setup
├── jobs/                 # Scheduled jobs (cron-based feed updates)
└── email/                # Resend email service
```

### API Response Format

All API endpoints return `{ code: number, msg: string, data: any }`:
- `code: 0` = success, `code: 1` = error
- `msg` = status message
- `data` = response payload

### Route Registration Pattern

Routes are registered in `index.ts` via `app.route('/prefix', router)`:
- `/telegram` - Telegram bot webhook/polling
- `/api/user` - User management
- `/api/subscribe` - Podcast subscriptions
- `/api/playlist` - User playlists
- `/api/listenlater` - Listen later queue
- `/api/rss` - RSS feed endpoints

### Database

- **PostgreSQL** via Prisma ORM
- Singleton pattern in `db/prisma.client.ts`
- Production: connection limit 5, pool timeout 10s

### External Services

- **Telegram Bot** - via `telegram/bot.setup.ts` for bot initialization
- **Resend** - Email notifications (`email/resend.ts`)
- **iTunes API** - Podcast search (`utils/itunes.ts`)
- **Spotify** - Episode details (`utils/spotify.ts`)

### Scheduled Jobs

Jobs are registered in `jobs/job_register.ts` using cron expressions (cronbake).
