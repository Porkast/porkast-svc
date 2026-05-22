import type { Env } from '../env';
import { SetBotCommands } from './bot';

export async function setupTelegramWebhook(env: Env) {
    const botToken = env.TELE_BOT_TOKEN;
    const webhookUrl = env.BOT_WEBHOOK_URL;

    if (!botToken || !webhookUrl) {
        console.warn('TELE_BOT_TOKEN or BOT_WEBHOOK_URL not configured, skipping webhook setup');
        return;
    }

    try {
        const response = await fetch(
            `https://api.telegram.org/bot${botToken}/setWebhook`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: webhookUrl }),
            }
        );
        const data = await response.json() as any;
        if (data.ok) {
            console.log('Telegram webhook set successfully:', webhookUrl);
        } else {
            console.error('Telegram webhook setup failed:', data.description);
        }
    } catch (error) {
        console.error('Telegram webhook setup error:', error);
    }

    try {
        await SetBotCommands(botToken);
    } catch (error) {
        console.error('Set bot commands error:', error);
    }
}
