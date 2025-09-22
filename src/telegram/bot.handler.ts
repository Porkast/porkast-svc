import { sendCommonTextMessage } from './bot';
import { handleSubscribeCommand, handleSubscribeCallbackQuery } from './bot.handler.subscribe';
import { HELP_COMMAND, START_COMMAND, SUBSCRIBE_COMMAND } from './bot.types';

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

export async function processUpdate(update: any) {
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
        const teleUserId = update.callback_query.from.id.toString();

        console.debug(`received callback query from ${teleUserId} (${chatId}): ${data}`);
        const dataParts = data.split(':');
        const commandType = dataParts[1];
        if (commandType === SUBSCRIBE_COMMAND) {
            await handleSubscribeCallbackQuery(chatId, messageId, data, teleUserId);
        }
    }
}
