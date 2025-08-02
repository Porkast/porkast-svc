import { Hono } from 'hono';

const teleBot = new Hono();

const TELEGRAM_BOT_TOKEN = process.env.TELE_BOT_TOKEN;

teleBot.post('/bot-webhook', async (c) => {
    try {
        const update = await c.req.json();
        console.debug('received update:', JSON.stringify(update, null, 2));

        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text;
            const userName = update.message.from.first_name || 'unknown user';

            console.debug(`received message from ${userName} (${chatId}): "${text}"`);

            const responseText = `Hello`;
            await sendMessage(chatId, responseText);
        } else if (update.callback_query) {
            const chatId = update.callback_query.message.chat.id;
            const data = update.callback_query.data;
            console.debug(`received callback query from ${chatId}: ${data}`);
        }
        return c.json({ ok: true });
    } catch (error) {
        console.error('Error processing update:', error);
        return c.json({ ok: false, error: 'Internal Server Error' }, 200);
    }
});

async function sendMessage(chatId: number, text: string) {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error('TELEGRAM_BOT_TOKEN is not set, cannot send message.');
        return;
    }
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
            }),
        });
        const data = await response.json();
        if (!data.ok) {
            console.error('Send message failed:', data.description);
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

async function answerCallbackQuery(callbackQueryId: string, text: string = '') {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error('TELEGRAM_BOT_TOKEN is not set, cannot answer callback query.');
        return;
    }
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                callback_query_id: callbackQueryId,
                text: text,
            }),
        });
        const data = await response.json();
        if (!data.ok) {
            console.error('Send message failed:', data.description);
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

export default teleBot