# Porkast Service

A backend service for Porkast providing podcast subscription management, notifications, and feed processing.

## Features

- Podcast subscription management
- Telegram bot integration
- Email notifications via Resend
- Scheduled jobs for feed updates
- iTunes API integration

## Prerequisites

- [Bun](https://bun.sh/) (v1.0.0 or later)
- PostgreSQL database
- Telegram bot token
- Resend API key

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

Edit the `.env` file with your configuration:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/porkast"
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
RESEND_API_KEY="your_resend_api_key"
```

4. Run database migrations:

```bash
bunx prisma migrate dev
```

## Running the Service

Development mode (with hot reload):

```bash
bun run dev
```

Production mode:

```bash
bun run start
```

## Deployment

### Docker

1. Build the Docker image:

```bash
docker build -t porkast-svc .
```

2. Run the container:

```bash
docker run -d --name porkast-svc -p 3000:3000 --env-file .env porkast-svc
```

### PM2

1. Install PM2 globally:

```bash
npm install -g pm2
```

2. Start the service:

```bash
pm2 start "bun run start" --name porkast-svc
```

## Project Structure

```
src/
├── index.ts          # Main application entry
├── db/               # Database related code
├── email/            # Email services
├── jobs/             # Scheduled jobs
├── models/           # Data models
├── telegram/         # Telegram bot
└── utils/            # Utility functions
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
