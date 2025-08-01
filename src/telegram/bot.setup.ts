
const BOT_TOKEN = process.env.TELE_BOT_TOKEN;
const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL;

if (!BOT_TOKEN || !BOT_WEBHOOK_URL) {
    console.error('please check TELE_BOT_TOKEN and BOT_WEBHOOK_URL in .env');
    process.exit(1);
}

const webhookUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;

export async function SetupTelegramWebhook() {
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
            console.log('Telegram Webhook set successfully:', data);
            console.log('Webhook URL:', BOT_WEBHOOK_URL);
        } else {
            console.error('Telegram Webhook set failed:', data.description);
        }
    } catch (error) {
        console.error('set Webhook error:', error);
    }
}
