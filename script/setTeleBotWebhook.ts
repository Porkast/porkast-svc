
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL;

if (!BOT_TOKEN || !BOT_WEBHOOK_URL) {
    console.error('please check TELEGRAM_BOT_TOKEN and YOUR_WEBHOOK_URL in .env');
    process.exit(1);
}

const webhookUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;

async function setTelegramWebhook() {
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: BOT_WEBHOOK_URL,
                allowed_updates: ['message', 'callback_query']
            }),
        });

        const data = await response.json();
        if (data.ok) {
            console.log('Telegram Webhook set successfully:', data.description);
        } else {
            console.error('Telegram Webhook set failed:', data.description);
        }
    } catch (error) {
        console.error('set Webhook error:', error);
    }
}

setTelegramWebhook();