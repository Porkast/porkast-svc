# Porkast Service - iFlow CLI Context Documentation

## Project Overview

Porkast Service is a backend service based on TypeScript and Bun, providing podcast subscription management, notifications, and RSS feed processing capabilities. The project uses the Hono framework to build REST APIs, integrated with Telegram bot, email notifications, and scheduled job systems.

### Tech Stack

- **Runtime**: Bun (v1.0.0+)
- **Language**: TypeScript
- **Web Framework**: Hono
- **Database**: PostgreSQL (using Prisma ORM)
- **Key Dependencies**:
  - Hono (HTTP framework)
  - Prisma (database ORM)
  - Resend (email service)
  - cronbake (scheduled tasks)
  - rss-parser (RSS parsing)
  - podcast (podcast processing)

## Project Structure

```txt
src/
├── index.ts              # Main application entry point
├── api/                  # API routes
│   ├── listenlater/      # Listen later functionality
│   ├── playlist/         # Playlist functionality
│   ├── rss/              # RSS subscriptions
│   ├── subscribe/        # Subscription management
│   └── user/             # User management
├── db/                   # Database related code
├── email/                # Email services
├── jobs/                 # Scheduled tasks
├── models/               # Data models
├── telegram/             # Telegram bot
└── utils/                # Utility functions
```

## Building and Running

### Development Environment

```bash
# Install dependencies
bun install

# Run database migrations
bunx prisma migrate dev

# Development mode (hot reload)
bun run dev
```

### Production Environment

```bash
# Run in production mode
bun run start
```

### Testing

```bash
# Run tests (Jest-based)
bun test
```

## Development Conventions

### Code Style

- Use TypeScript strict mode
- Follow Hono framework routing patterns
- Use Prisma for database operations
- Use Zod for data validation

### API Structure

- All API routes are located in the `src/api/` directory
- Each functional module includes: route files, business logic files, type definition files, and test files
- Use `@hono/zod-validator` for request validation

### Database Schema

- Use Prisma Schema to define data models
- Divided into two schemas: `auth` and `public`
- Main entities: users, podcast feeds, podcast items, subscriptions, playlists

### Telegram Bot

- Bot code is located in the `src/telegram/` directory
- Supports podcast subscription, search, and notification features
- Sends messages using HTML format

### Scheduled Tasks

- Use cronbake to manage scheduled tasks
- Task registration is located in `src/jobs/job_register.ts`
- Main task: user subscription updates

## Environment Configuration

The project requires the following environment variables:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/porkast"
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
RESEND_API_KEY="your_resend_api_key"
PORKAST_WEB_BASE_URL="https://your-frontend-url.com"
```

## Deployment

### Docker Deployment

```bash
# Build image
docker build -t porkast-svc .

# Run container
docker run -d --name porkast-svc -p 3000:3000 --env-file .env porkast-svc
```

### PM2 Deployment

```bash
# Install PM2
npm install -g pm2

# Start service
pm2 start "bun run start" --name porkast-svc
```

## Main Functional Modules

### 1. User Management (`src/api/user/`)

- User registration and authentication
- User information management

### 2. Subscription Management (`src/api/subscribe/`)

- Podcast subscriptions
- Keyword subscriptions
- Subscription update notifications

### 3. Playlists (`src/api/playlist/`)

- Create and manage playlists
- Add podcast items to playlists

### 4. Listen Later (`src/api/listenlater/`)

- Save podcast items for later listening

### 5. RSS Subscriptions (`src/api/rss/`)

- RSS feed management
- Podcast content updates

### 6. Telegram Bot (`src/telegram/`)

- Podcast search and subscription
- Update notifications
- Interactive commands

## Database Relationships

Core data tables:

- `user_info`: User basic information
- `user_subscription`: User subscriptions
- `feed_channel`: Podcast channels
- `feed_item`: Podcast items
- `user_playlist`: User playlists
- `user_listen_later`: Listen later list

## Development Notes

1. **Database Migrations**: After modifying the database schema, you need to run `bunx prisma migrate dev`
2. **Environment Variables**: Ensure all required environment variables are correctly configured
3. **API Testing**: Each functional module has corresponding test files
4. **Logging**: Use `src/utils/logger.ts` for logging
5. **Error Handling**: Follow unified error handling patterns

## Common Commands

```bash
# View database schema
bunx prisma studio

# Generate Prisma client
bunx prisma generate

# Reset database
bunx prisma migrate reset

# View application logs
bun run dev 2>&1 | tee app.log
```
