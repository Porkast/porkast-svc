import { sendCommonTextMessage, sendMessage, editMessage, sendAudio } from './bot';
import { searchPodcastEpisodeFromItunes, getPodcastEpisodeInfo } from '../utils/itunes';
import { FeedItem, FeedChannel } from '../models/feeds';
import { InlineKeyboardButton, RenderedDetail } from './types';
import { cleanHtmlForTelegram } from './bot.handler';
import { doSearchSubscription, recoredUserKeywordSubscription as recordUserKeywordSubscription } from '../db/subscription';
import { getUserInfoByTelegramId } from '../db/user';

const SEARCH_PAGE_SIZE = 10;

// Temporary storage for search result GUIDs to keep callback_data short
const searchResultMap = new Map<string, {feedId: string, guid: string}>();
// Temporary storage for audio URLs to keep callback_data short
const audioUrlMap = new Map<string, {url: string, title: string, podcast: string}>();


export async function handleSearch(chatId: number, keyword: string, page: number = 0, messageId?: number): Promise<void> {
    try {
        const offset = page * SEARCH_PAGE_SIZE;
        const totalCount = 200;
        const feedItems = await searchPodcastEpisodeFromItunes(keyword, 'podcastEpisode', 'US', '', offset, SEARCH_PAGE_SIZE, totalCount);

        if (feedItems.length === 0) {
            console.debug(`No results found for "${keyword}"`);
            await sendCommonTextMessage(chatId, `No results found for "${keyword}"`);
            return;
        }

        // Estimate total pages - if we got full page size, assume there's more
        const hasMore = feedItems.length === SEARCH_PAGE_SIZE;
        const totalPages = hasMore ? page + 2 : page + 1;

        const keyboard = renderSearchResultsKeyboard(feedItems, keyword, page, totalPages);

        const requestBody = {
            chat_id: chatId,
            text: `Search results for "${keyword}" (Page ${page + 1}):`,
            reply_markup: {
                inline_keyboard: keyboard
            }
        };

        if (messageId) {
            console.debug(`Editing message ${messageId} with requestBody ${JSON.stringify(requestBody)}`);
            const editBody = { ...requestBody, message_id: messageId };
            await editMessage(JSON.stringify(editBody));
        } else {
            console.debug(`Sending message ${messageId} with requestBody ${JSON.stringify(requestBody)}`);
            await sendMessage(JSON.stringify(requestBody));
        }
    } catch (error) {
        console.error('Error handling search:', error);
        await sendCommonTextMessage(chatId, 'Error searching podcasts.');
    }
}

export function renderSearchResultsKeyboard(feedItems: FeedItem[], keyword: string, currentPage: number, totalPages: number): InlineKeyboardButton[][] {
    const keyboard: InlineKeyboardButton[][] = [];

    for (const item of feedItems) {
        // Generate short ID and store mapping
        const shortId = crypto.randomUUID().substring(0, 8);
        searchResultMap.set(shortId, { feedId: String(item.FeedId), guid: item.GUID });

        keyboard.push([{
            text: item.Title,
            callback_data: `search_detail:search:${shortId}:${keyword}:${currentPage}`
        }]);
    }

    // Add subscribe button above pagination
    const subscribeRow: InlineKeyboardButton[] = [{
        text: 'Subscribe to this search',
        callback_data: `search_subscribe:search:${keyword}`
    }];
    keyboard.push(subscribeRow);

    const navRow: InlineKeyboardButton[] = [];
    if (currentPage > 0) {
        navRow.push({
            text: 'Previous',
            callback_data: `search_prev:search:${keyword}:${currentPage}`
        });
    }
    if (currentPage < totalPages - 1) {
        navRow.push({
            text: 'Next',
            callback_data: `search_next:search:${keyword}:${currentPage}`
        });
    }
    if (navRow.length > 0) {
        keyboard.push(navRow);
    }

    return keyboard;
}

export function renderSearchResultItemKeyboard(episode: FeedItem, podcast: FeedChannel, keyword: string, currentPage: number): RenderedDetail {
    const description = cleanHtmlForTelegram(episode.Description);
    const html = `<b>${episode.Title}</b>\n\n` +
        `<b>Podcast:</b> ${podcast.Title}\n` +
        `<b>Duration:</b> ${episode.Duration}\n` +
        `<b>Published:</b> ${episode.PubDate}\n\n` +
        `<b>Description:</b>\n${description}`;

    // Generate short ID for audio URL and store mapping
    const audioShortId = crypto.randomUUID().substring(0, 8);
    audioUrlMap.set(audioShortId, { url: episode.EnclosureUrl, title: episode.Title, podcast: podcast.Title });

    const keyboard: InlineKeyboardButton[][] = [
        [{
            text: '🎧 Listen to Episode',
            callback_data: `search_play:search:${audioShortId}`
        }],
        [{
            text: 'Back to Search Results',
            callback_data: `search_back:search:${keyword}:${currentPage}`
        }]
    ];

    return { text: html, keyboard: keyboard };
}

export async function handleSearchCallbackQuery(teleUserId : string, chatId: number, messageId: number, data: string): Promise<void> {
    if (!data.startsWith('search_')) return;

    const parts = data.split(':');
    const action = parts[0];
    const command = parts[1]; // 'search'
    const payload = parts.slice(2);

    if (action === 'search_prev' || action === 'search_next') {
        const [keyword, currentPageStr] = payload;
        const currentPage = parseInt(currentPageStr);
        const newPage = action === 'search_prev' ? currentPage - 1 : currentPage + 1;
        await handleSearch(chatId, keyword, newPage, messageId);
    } else if (action === 'search_detail') {
        const [shortId, keyword, currentPageStr] = payload;
        const mapping = searchResultMap.get(shortId);

        if (!mapping) {
            await sendCommonTextMessage(chatId, 'Episode details not found. Please search again.');
            return;
        }

        try {
            const { podcast, episode } = await getPodcastEpisodeInfo(mapping.feedId, mapping.guid);
            const { text, keyboard } = renderSearchResultItemKeyboard(episode, podcast, keyword, parseInt(currentPageStr));

            const editBody = {
                chat_id: chatId,
                message_id: messageId,
                text: text,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: keyboard
                }
            };

            await editMessage(JSON.stringify(editBody));
        } catch (error) {
            console.error('Error fetching episode details:', error);
            await sendCommonTextMessage(chatId, 'Error loading episode details.');
        } finally {
            // Clean up the mapping to prevent memory leaks
            searchResultMap.delete(shortId);
        }
    } else if (action === 'search_back') {
        const [keyword, currentPageStr] = payload;
        const currentPage = parseInt(currentPageStr);
        await handleSearch(chatId, keyword, currentPage, messageId);
    } else if (action === 'search_subscribe') {
        const [keyword] = payload;
        try {
            const userInfo = await getUserInfoByTelegramId(teleUserId);
            const result = await recordUserKeywordSubscription(userInfo.userId, keyword, 'itunes', 'US', '', 0);
            let responseText = '';
            if (!result) {
                await doSearchSubscription(keyword, 'US', 'itunes', '');
                responseText = `Successfully subscribed to "${keyword}"!`;
            } else {
                responseText = result
            }
            await sendCommonTextMessage(chatId, responseText);
        } catch (error) {
            console.error('Error subscribing to search:', error);
            await sendCommonTextMessage(chatId, 'Error subscribing to search results.');
        }
    } else if (action === 'search_play') {
        const [audioShortId] = payload;
        const audioInfo = audioUrlMap.get(audioShortId);
        
        if (!audioInfo) {
            await sendCommonTextMessage(chatId, 'Audio URL not found. Please try again.');
            return;
        }

        try {
            console.debug(`Attempting to play audio from URL: ${audioInfo.url}`);
            
            if (!audioInfo.url || audioInfo.url.trim() === '') {
                await sendCommonTextMessage(chatId, 'Audio URL is empty. Cannot play episode.');
                return;
            }

            // Send audio using Telegram's dedicated audio API
            console.debug(`Sending audio to chat ${chatId} with URL: ${audioInfo.url} and title: ${audioInfo.title}`);
            await sendAudio(chatId, audioInfo.url, audioInfo.title, audioInfo.podcast);
        } catch (error) {
            console.error('Error playing audio:', error);
            await sendCommonTextMessage(chatId, 'Error playing audio. The audio file may be unavailable.');
        }
    }
}
