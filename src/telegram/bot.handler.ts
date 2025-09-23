import { sendCommonTextMessage } from './bot';
import { handleSubscribeCommand, handleSubscribeCallbackQuery } from './bot.handler.subscribe';
import { handleSearch, handleSearchCallbackQuery } from './bot.handler.search';
import { HELP_COMMAND, START_COMMAND, SUBSCRIBE_COMMAND } from './bot.types';
import { logger } from '../utils/logger';

function handleCommand(command: string): string {
    switch (command) {
        case START_COMMAND:
            return 'Welcome to Porkast! Type any keyword to search for podcasts. Use /help to see available commands.';
        case HELP_COMMAND:
            return 'Available commands:\n/start - Welcome message\n/help - This help\n/subscribe - View subscriptions\n\nType any keyword to search for podcast episodes!';
        default:
            return 'Unknown command. Use /help to see available commands.';
    }
}

export async function processUpdate(update: any) {
    if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const userName = update.message.from.first_name || 'unknown user';
        const teleUserId = update.message.from.id.toString();

        logger.debug(`received message from ${userName} (${chatId}): "${text}"`);

        if (text && text.startsWith('/')) {
            const command = text.split(' ')[0].substring(1);
            if (command === SUBSCRIBE_COMMAND) {
                await handleSubscribeCommand(chatId, teleUserId, 0);
            } else {
                const responseText = handleCommand(command);
                await sendCommonTextMessage(chatId, responseText);
            }
        } else if (text) {
            // Treat as search query
            logger.debug(`Received search query from ${userName} (${chatId}): "${text}"`);
            await handleSearch(chatId, text.trim(), 0);
        }
    } else if (update.callback_query) {
        const chatId = update.callback_query.message.chat.id;
        const data = update.callback_query.data;
        const messageId = update.callback_query.message.message_id;
        const teleUserId = update.callback_query.from.id.toString();

        logger.debug(`received callback query from ${teleUserId} (${chatId}): ${data}`);
        const dataParts = data.split(':');
        const commandType = dataParts[1];
        if (commandType === SUBSCRIBE_COMMAND) {
            await handleSubscribeCallbackQuery(chatId, messageId, data, teleUserId);
        } else if (commandType === 'search') {
            await handleSearchCallbackQuery(teleUserId, chatId, messageId, data);
        }
    }
}

// Clean HTML content for Telegram compatibility
export function cleanHtmlForTelegram(html: string): string {
    if (!html) return '';

    // Remove unsupported tags and their content
    let cleaned = html
        .replace(/<img[^>]*>/gi, '') // Remove images
        .replace(/<br[^>]*>/gi, '\n') // Convert breaks to newlines
        .replace(/<\/?p[^>]*>/gi, '\n') // Convert paragraphs to newlines
        .replace(/<strong[^>]*>/gi, '<b>') // Convert strong to bold
        .replace(/<\/strong>/gi, '</b>') // Convert closing strong to bold
        .replace(/<em[^>]*>/gi, '<i>') // Convert em to italic
        .replace(/<\/em>/gi, '</i>') // Convert closing em to italic
        .replace(/<[^>]*>/gi, ''); // Remove all remaining HTML tags

    // Decode HTML entities
    cleaned = cleaned
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/&/g, '&')
        .replace(/"/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');

    // Clean up excessive whitespace
    cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim();

    // Truncate if too long (Telegram has message limits)
    if (cleaned.length > 1000) {
        cleaned = cleaned.substring(0, 1000) + '...';
    }

    return cleaned;
}
