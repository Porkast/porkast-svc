import { sendCommonTextMessage } from './bot';
import { handleSubscribeCommand, handleSubscribeCallbackQuery } from './bot.handler.subscribe';
import { handleSearch, handleSearchCallbackQuery } from './bot.handler.search';
import { HELP_COMMAND, SEARCH_COMMAND, START_COMMAND, SUBSCRIBE_COMMAND } from './bot.types';
import { logger } from '../utils/logger';
import { FeedItem, FeedChannel } from '../models/feeds';
import { InlineKeyboardButton, RenderedDetail } from './types';
import { getUserInfoByTelegramId, createUserFromTelegramInfo } from '../db/user';

// Temporary storage for search result GUIDs to keep callback_data short
export const searchResultMap = new Map<string, {feedId: string, guid: string}>();
// Temporary storage for subscription detail GUIDs to keep callback_data short
export const subscriptionDetailMap = new Map<string, {feedId: string, guid: string}>();
// Temporary storage for audio URLs to keep callback_data short
export const audioUrlMap = new Map<string, {url: string, title: string, podcast: string}>();

export function renderEpisodeDetailKeyboard(episode: FeedItem, podcast: FeedChannel, keyword: string, currentPage: number, commandType: string, callbackPrefix: string): RenderedDetail {
    const description = cleanHtmlForTelegram(episode.Description);
    const porkastItemUrl = process.env.PORKAST_WEB_BASE_URL + `/podcast/${episode.FeedId}/episode/${episode.GUID}`
    const html = `<b>${episode.Title}</b>\n\n` +
        `<b>Podcast:</b> ${podcast.Title}\n` +
        `<b>Duration:</b> ${episode.Duration}\n` +
        `<b>Published:</b> ${episode.PubDate}\n\n` +
        `<b>Description:</b>\n${description}\n\n` +
        `<a href="${porkastItemUrl}">🎧 To Porkast listen this episode</a>`;

    // Generate short ID for audio URL and store mapping
    const audioShortId = crypto.randomUUID().substring(0, 8);
    audioUrlMap.set(audioShortId, { url: episode.EnclosureUrl, title: episode.Title, podcast: podcast.Title });

    const keyboard: InlineKeyboardButton[][] = [
        [{
            text: '🎧 Listen to Episode',
            callback_data: `${commandType}:${callbackPrefix}_play:${audioShortId}`
        }],
        [{
            text: 'Back to Search Results',
            callback_data: `${commandType}:${callbackPrefix}_back:${keyword}:${currentPage}`
        }]
    ];

    return { text: html, keyboard: keyboard };
}


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
            } else if (command === START_COMMAND) {
                // Handle /start command with auto-registration
                const userInfo = await getUserInfoByTelegramId(teleUserId);
                if (!userInfo.userId) {
                    // User doesn't exist - create new user
                    const newUser = await createUserFromTelegramInfo({
                        id: teleUserId,
                        username: update.message.from.username,
                        first_name: update.message.from.first_name,
                        last_name: update.message.from.last_name
                    });
                    await sendCommonTextMessage(chatId, `Welcome to Porkast, ${newUser.nickname}! Type any keyword to search for podcasts.`);
                } else {
                    // User exists - welcome back
                    await sendCommonTextMessage(chatId, `Welcome back, ${userInfo.nickname}! Type any keyword to search for podcasts.`);
                }
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
        const commandType = dataParts[0];
        if (commandType === SUBSCRIBE_COMMAND) {
            await handleSubscribeCallbackQuery(chatId, messageId, data, teleUserId);
        } else if (commandType === SEARCH_COMMAND) {
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
