import { sendCommonTextMessage, sendMessage, editMessage, sendAudio } from './bot';
import { FeedItem, FeedChannel } from '../models/feeds';
import { InlineKeyboardButton, RenderedDetail } from './types';
import { searchResultMap, audioUrlMap, renderEpisodeDetailKeyboard } from './bot.handler';
import { doSearchSubscription, recoredUserKeywordSubscription as recordUserKeywordSubscription } from '../db/subscription';
import { getUserInfoByTelegramId } from '../db/user';
import { logger } from '../utils/logger';
import { SEARCH_COMMAND } from './bot.types';
import { getSpotifyEpisodeDetail, getSpotifyShowDetail, searchSpotifyEpisodes } from '../utils/spotify';
import { PODCAST_SOURCES, DEFAULT_PODCAST_SOURCE } from '../models/types';
import { getPodcastEpisodeInfo, searchPodcastEpisodeFromItunes } from '../utils/itunes';


export async function handleSearch(chatId: number, keyword: string, page: number = 0, messageId?: number): Promise<void> {
    try {
        const SEARCH_PAGE_SIZE = 10;
        const offset = page * SEARCH_PAGE_SIZE;
        const totalCount = 200;
        const feedItems = await searchPodcastEpisodeFromItunes(keyword, 'podcastEpisode', 'US', '', offset, SEARCH_PAGE_SIZE, totalCount);
        // const feedItems = await searchSpotifyEpisodes(keyword, 'US', SEARCH_PAGE_SIZE, offset);

        if (feedItems.length === 0) {
            logger.debug(`No results found for "${keyword}"`);
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
            logger.debug(`Editing message ${messageId} with requestBody ${JSON.stringify(requestBody)}`);
            const editBody = { ...requestBody, message_id: messageId };
            await editMessage(JSON.stringify(editBody));
        } else {
            logger.debug(`Sending message ${messageId} with requestBody ${JSON.stringify(requestBody)}`);
            await sendMessage(JSON.stringify(requestBody));
        }
    } catch (error) {
        logger.error('Error handling search:', error);
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
            callback_data: `search:search_detail:${shortId}:${keyword}:${currentPage}`
        }]);
    }

    // Add subscribe button above pagination
    const subscribeRow: InlineKeyboardButton[] = [{
        text: 'Subscribe to this search',
        callback_data: `search:search_subscribe:${keyword}`
    }];
    keyboard.push(subscribeRow);

    const navRow: InlineKeyboardButton[] = [];
    if (currentPage > 0) {
        navRow.push({
            text: 'Previous',
            callback_data: `search:search_prev:${keyword}:${currentPage}`
        });
    }
    if (currentPage < totalPages - 1) {
        navRow.push({
            text: 'Next',
            callback_data: `search:search_next:${keyword}:${currentPage}`
        });
    }
    if (navRow.length > 0) {
        keyboard.push(navRow);
    }

    return keyboard;
}

export function renderSearchResultItemKeyboard(episode: FeedItem, podcast: FeedChannel, keyword: string, currentPage: number): RenderedDetail {
    return renderEpisodeDetailKeyboard(episode, podcast, keyword, currentPage, SEARCH_COMMAND, 'search_item_detail');
}

export async function handleSearchCallbackQuery(teleUserId : string, chatId: number, messageId: number, data: string): Promise<void> {
    if (!data.startsWith('search:')) return;

    const parts = data.split(':');
    const command = parts[0]; // 'search'
    const action = parts[1];
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
            // const episode = await getSpotifyEpisodeDetail(mapping.guid);
            // const podcast = await getSpotifyShowDetail(episode.ChannelId);
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
            logger.error('Error fetching episode details:', error);
            await sendCommonTextMessage(chatId, 'Error loading episode details.');
        } finally {
            // Clean up the mapping to prevent memory leaks
            searchResultMap.delete(shortId);
        }
    } else if (action === 'search_item_detail_back') {
        const [keyword, currentPageStr] = payload;
        const currentPage = parseInt(currentPageStr);
        await handleSearch(chatId, keyword, currentPage, messageId);
    } else if (action === 'search_subscribe') {
        const [keyword] = payload;
        try {
            const userInfo = await getUserInfoByTelegramId(teleUserId);
            const result = await recordUserKeywordSubscription(userInfo.userId, keyword, DEFAULT_PODCAST_SOURCE, 'US', '', 0);
            let responseText = '';
            if (!result) {
                await doSearchSubscription(keyword, 'US', DEFAULT_PODCAST_SOURCE, '');
                responseText = `Successfully subscribed to "${keyword}"!`;
            } else {
                responseText = result
            }
            await sendCommonTextMessage(chatId, responseText);
        } catch (error) {
            logger.error('Error subscribing to search:', error);
            await sendCommonTextMessage(chatId, 'Error subscribing to search results.');
        }
    } else if (action === 'searchsearch_item_detail_play') {
        const [audioShortId] = payload;
        const audioInfo = audioUrlMap.get(audioShortId);
        
        if (!audioInfo) {
            await sendCommonTextMessage(chatId, 'Audio URL not found. Please try again.');
            return;
        }

        try {
            logger.debug(`Attempting to play audio from URL: ${audioInfo.url}`);
            
            if (!audioInfo.url || audioInfo.url.trim() === '') {
                await sendCommonTextMessage(chatId, 'Audio URL is empty. Cannot play episode.');
                return;
            }

            // Send audio using Telegram's dedicated audio API
            logger.debug(`Sending audio to chat ${chatId} with URL: ${audioInfo.url} and title: ${audioInfo.title}`);
            await sendAudio(chatId, audioInfo.url, audioInfo.title, audioInfo.podcast);
        } catch (error) {
            logger.error('Error playing audio:', error);
            await sendCommonTextMessage(chatId, 'Error playing audio. The audio file may be unavailable.');
        }
    }
}
