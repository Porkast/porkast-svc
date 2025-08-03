import { Hono } from 'hono';
import { sendCommonTestMessage } from './bot';

const teleBot = new Hono();

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
            await sendCommonTestMessage(chatId, responseText);
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


export default teleBot