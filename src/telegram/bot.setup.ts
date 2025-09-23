import { logger } from "../utils/logger";
import { SetBotCommands } from "./bot";
import { startPolling } from "./bot.polling";

export const BOT_TOKEN = process.env.TELE_BOT_TOKEN || '';
export const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL;

async function setupWebhook() {
    if (!BOT_TOKEN || !BOT_WEBHOOK_URL) {
        logger.error('Please check TELE_BOT_TOKEN and BOT_WEBHOOK_URL in .env for production');
        process.exit(1);
    }

    const webhookUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: BOT_WEBHOOK_URL,
            }),
        });

        const data = await response.json();
        if (data.ok) {
            logger.info('Telegram Webhook set successfully:', data);
            logger.info('Webhook URL:', BOT_WEBHOOK_URL);
        } else {
            logger.error('Telegram Webhook set failed:', data.description);
        }
    } catch (error) {
        logger.error('set Webhook error:', error);
    }
}

export function InitTelegramBot() {
    if (process.env.NODE_ENV === 'production') {
        logger.info('Setting up bot in webhook mode for production...');
        setupWebhook();
        SetBotCommands();
    } else {
        logger.info('Setting up bot in polling mode for development...');
        if (!BOT_TOKEN) {
            logger.error('Please check TELE_BOT_TOKEN in .env for development');
            process.exit(1);
        }
        // In development, we don't want to block the main thread
        startPolling().catch(err => logger.error("Polling error:", err));
        SetBotCommands();
    }
}
