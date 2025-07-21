# Porkast Backend Service

A backend service for managing podcast subscriptions and notifications, built with AWS CDK and TypeScript.

## Features

- **Subscription Management**: Track and update user podcast subscriptions
- **Notifications**: Send updates via Email and Telegram
- **Background Jobs**: Regularly check for new podcast episodes
- **AWS Infrastructure**: Deployed using AWS CDK with Lambda functions

## How It Works

The service consists of several key components:

1. **Subscription System**:
   - Manages user podcast subscriptions in a database
   - Tracks which episodes users have seen
   - Handles subscription updates

2. **Notification System**:
   - Sends email notifications using Resend
   - Provides Telegram bot integration for updates

3. **Background Jobs**:
   - Regularly checks for new podcast episodes
   - Updates user subscriptions
   - Triggers notifications when new content is available

4. **AWS Infrastructure**:
   - Deployed using AWS CDK
   - Uses Lambda functions for core functionality
   - Includes necessary IAM roles and permissions

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- AWS account with proper permissions
- AWS CLI configured
- Telegram bot token (if using Telegram notifications)
- Resend API key (if using email notifications)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Porkast/porkast-svc.git
   cd porkast-svc
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   Edit `.env` with your configuration

4. Run database migrations:

   ```bash
   npx prisma migrate dev
   ```

## Configuration

Configure the service by setting these environment variables:

- `DATABASE_URL`: PostgreSQL connection string
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `RESEND_API_KEY`: Resend email API key
- `NOTIFICATION_EMAIL`: Default sender email address

## Development

- Build the project:

  ```bash
  npm run build
  ```

- Watch for changes:

  ```bash
  npm run watch
  ```

- Run tests:

  ```bash
  npm run test
  ```

## Deployment

1. Bootstrap CDK (first time only):

   ```bash
   npm cdk bootstrap
   ```

2. Deploy to AWS:

   ```bash
   npx cdk deploy
   ```

3. Other useful CDK commands:

   ```bash
   npx cdk diff    # Compare deployed stack with current state
   npx cdk synth   # Emits the synthesized CloudFormation template
   ```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
