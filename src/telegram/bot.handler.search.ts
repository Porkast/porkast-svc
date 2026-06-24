import { sendCommonTextMessage, sendMessage, editMessage, sendAudio } from './bot';
import { FeedItem, FeedChannel } from '../models/feeds';
import { InlineKeyboardButton, RenderedDetail } from './types';
import { searchResultMap, audioUrlMap, renderEpisodeDetailKeyboard } from './bot.handler';
import { doSearchSubscription, recoredUserKeywordSubscription as recordUserKeywordSubscription } from '../db/subscription';
import { getUserInfoByTelegramId } from '../db/user';
import { logger } from '../utils/logger';
import { SEARCH_COMMAND } from './bot.types';
import { DEFAULT_PODCAST_SOURCE } from '../models/types';
import { getPodcastEpisodeInfo, searchPodcastEpisodeFromItunes } from '../utils/itunes';
import type { Env } from '../env';
import type { DbClient } from '../db/types';


export async function handleSearch(env: Env, chatId: number, keyword: string, page: number = 0, messageId?: number): Promise<void> {
    const botToken = env.TELE_BOT_TOKEN;
    const miniAppLink = env.TELE_MINI_APP_LINK;
    try {
        const SEARCH_PAGE_SIZE = 10;
        const offset = page * SEARCH_PAGE_SIZE;
        const totalCount = 200;
        const feedItems = await searchPodcastEpisodeFromItunes(keyword, 'podcastEpisode', 'US', '', offset, SEARCH_PAGE_SIZE, totalCount);

        if (feedItems.length === 0) {
            logger.debug(`No results found for "${keyword}"`);
            await sendCommonTextMessage(botToken, chatId, `No results found for "${keyword}"`);
            return;
        }

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
            await editMessage(botToken, JSON.stringify(editBody));
        } else {
            logger.debug(`Sending message ${messageId} with requestBody ${JSON.stringify(requestBody)}`);
            await sendMessage(botToken, JSON.stringify(requestBody));
        }
    } catch (error) {
        logger.error('Error handling search:', error);
        await sendCommonTextMessage(botToken, chatId, 'Error searching podcasts.');
    }
}

export function renderSearchResultsKeyboard(feedItems: FeedItem[], keyword: string, currentPage: number, totalPages: number): InlineKeyboardButton[][] {
    const keyboard: InlineKeyboardButton[][] = [];

    for (const item of feedItems) {
        const shortId = crypto.randomUUID().substring(0, 8);
        searchResultMap.set(shortId, { feedId: String(item.FeedId), guid: item.GUID });

        keyboard.push([{
            text: item.Title,
            callback_data: `search:search_detail:${shortId}:${keyword}:${currentPage}`
        }]);
    }

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

export function renderSearchResultItemKeyboard(env: Env, episode: FeedItem, podcast: FeedChannel, keyword: string, currentPage: number): RenderedDetail {
    return renderEpisodeDetailKeyboard(env, episode, podcast, keyword, currentPage, SEARCH_COMMAND, 'search_item_detail');
}

export async function handleSearchCallbackQuery(db: DbClient, env: Env, teleUserId: string, chatId: number, messageId: number, data: string): Promise<void> {
    if (!data.startsWith('search:')) return;

    const botToken = env.TELE_BOT_TOKEN;
    const miniAppLink = env.TELE_MINI_APP_LINK;

    const parts = data.split(':');
    const command = parts[0];
    const action = parts[1];
    const payload = parts.slice(2);

    if (action === 'search_prev' || action === 'search_next') {
        const [keyword, currentPageStr] = payload;
        const currentPage = parseInt(currentPageStr);
        const newPage = action === 'search_prev' ? currentPage - 1 : currentPage + 1;
        await handleSearch(env, chatId, keyword, newPage, messageId);
    } else if (action === 'search_detail') {
        const [shortId, keyword, currentPageStr] = payload;
        const mapping = searchResultMap.get(shortId);

        if (!mapping) {
            await sendCommonTextMessage(botToken, chatId, 'Episode details not found. Please search again.');
            return;
        }

        try {
            const { podcast, episode } = await getPodcastEpisodeInfo(mapping.feedId, mapping.guid);
            const { text, keyboard } = renderSearchResultItemKeyboard(env, episode, podcast, keyword, parseInt(currentPageStr));

            const editBody = {
                chat_id: chatId,
                message_id: messageId,
                text: text,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: keyboard
                }
            };

            await editMessage(botToken, JSON.stringify(editBody));
        } catch (error) {
            logger.error('Error fetching episode details:', error);
            await sendCommonTextMessage(botToken, chatId, 'Error loading episode details.');
        } finally {
            searchResultMap.delete(shortId);
        }
    } else if (action === 'search_item_detail_back') {
        const [keyword, currentPageStr] = payload;
        const currentPage = parseInt(currentPageStr);
        await handleSearch(env, chatId, keyword, currentPage, messageId);
    } else if (action === 'search_subscribe') {
        const [keyword] = payload;
        try {
            const userInfo = await getUserInfoByTelegramId(db, teleUserId);
            const result = await recordUserKeywordSubscription(db, userInfo.userId, keyword, DEFAULT_PODCAST_SOURCE, 'US', '', 0);
            let responseText = '';
            if (!result) {
                await doSearchSubscription(db, keyword, 'US', DEFAULT_PODCAST_SOURCE, '');
                responseText = `Successfully subscribed to "${keyword}"!`;
            } else {
                responseText = result
            }
            await sendCommonTextMessage(botToken, chatId, responseText);
        } catch (error) {
            logger.error('Error subscribing to search:', error);
            await sendCommonTextMessage(botToken, chatId, 'Error subscribing to search results.');
        }
    } else if (action === 'search_item_detail_play') {
        const [audioShortId] = payload;
        const audioInfo = audioUrlMap.get(audioShortId);

        if (!audioInfo) {
            await sendCommonTextMessage(botToken, chatId, 'Audio URL not found. Maybe you can try again.');
            return;
        }

        try {
            logger.debug(`Attempting to play audio from URL: ${audioInfo.url}`);

            if (!audioInfo.url || audioInfo.url.trim() === '') {
                await sendCommonTextMessage(botToken, chatId, 'Audio URL is empty. Cannot play episode.');
                return;
            }

            logger.debug(`Sending audio to chat ${chatId} with URL: ${audioInfo.url} and title: ${audioInfo.title}`);
            await sendAudio(botToken, chatId, audioInfo.url, audioInfo.title, audioInfo.podcast);
        } catch (error) {
            logger.error('Error playing audio:', error);
            await sendCommonTextMessage(botToken, chatId, 'Error playing audio. The audio file may be unavailable.');
        }
    }
}
