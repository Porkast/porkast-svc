import { Hono } from 'hono';
import { sendCommonTextMessage } from './bot';
import { handleSubscribeCommand, handleSubscribeCallbackQuery } from './bot.hook.subscribe';
import { HELP_COMMAND, START_COMMAND, SUBSCRIBE_COMMAND } from './bot.types';

const teleBot = new Hono();

teleBot.post('/bot-webhook', async (c) => {
    try {
        const update = await c.req.json();
        console.debug('received update:', JSON.stringify(update, null, 2));

        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text;
            const userName = update.message.from.first_name || 'unknown user';
            const userId = update.message.from.id.toString();

            console.debug(`received message from ${userName} (${chatId}): "${text}"`);

            if (text && text.startsWith('/')) {
                const command = text.split(' ')[0].substring(1);
                if (command === SUBSCRIBE_COMMAND) {
                    await handleSubscribeCommand(chatId, userId, 0);
                } else {
                    const responseText = handleCommand(command);
                    await sendCommonTextMessage(chatId, responseText);
                }
            } else {
                await sendCommonTextMessage(chatId, 'Hello');
            }
        } else if (update.callback_query) {
            const chatId = update.callback_query.message.chat.id;
            const data = update.callback_query.data;
            const messageId = update.callback_query.message.message_id;
            console.debug(`received callback query from ${chatId}: ${data}`);
            await handleSubscribeCallbackQuery(chatId, messageId, data);
        }
        return c.json({ ok: true });
    } catch (error) {
        console.error('Error processing update:', error);
        return c.json({ ok: false, error: 'Internal Server Error' }, 200);
    }
});

function handleCommand(command: string): string {
    switch (command) {
        case START_COMMAND:
            return 'Welcome to Porkast! Use /help to see available commands.';
        case HELP_COMMAND:
            return 'Available commands:\n/start - Welcome message\n/help - This help\n/subscribe - View subscriptions';
        default:
            return 'Unknown command. Use /help to see available commands.';
    }
}



export default teleBot
