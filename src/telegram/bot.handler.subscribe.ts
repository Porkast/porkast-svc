import { sendCommonTextMessage, sendMessage, editMessage, sendAudio } from './bot';
import { queryUserKeywordSubscriptionList, queryUserKeywordSubscriptionDetail, queryKeywordSubscriptionFeedItemList } from '../db/subscription';
import { SubscriptionDataDto } from '../models/subscription';
import { getUserInfoByTelegramId } from '../db/user';
import { FeedItem } from '../models/feeds';
import { InlineKeyboardButton, RenderedDetail } from './types';
import { logger } from '../utils/logger';
import { subscriptionDetailMap, audioUrlMap, renderEpisodeDetailKeyboard } from './bot.handler';
import { SUBSCRIBE_COMMAND } from './bot.types';
import { getSpotifyEpisodeDetail, getSpotifyShowDetail } from '../utils/spotify';

const SUBSCRIBE_PAGE_SIZE = 5;
const SUBSCRIBE_DETAIL_PAGE_SIZE = 10;

export async function handleSubscribeCommand(chatId: number, teleUserId: string, page: number, messageId?: number): Promise<void> {
    try {
        const offset = page * SUBSCRIBE_PAGE_SIZE;
        const userInfo = await getUserInfoByTelegramId(teleUserId);
        const subscriptions = await queryUserKeywordSubscriptionList(userInfo.userId, offset, SUBSCRIBE_PAGE_SIZE);

        if (subscriptions.length === 0) {
            await sendCommonTextMessage(chatId, 'You have no subscriptions yet.');
            return;
        }

        const totalCount = subscriptions[0]?.Count || 0;
        const totalPages = Math.ceil(totalCount / SUBSCRIBE_PAGE_SIZE);

        const keyboard = renderSubscribeKeyboard(subscriptions, teleUserId, page, totalPages);

        const requestBody = {
            chat_id: chatId,
            text: `Your subscriptions (Page ${page + 1}/${totalPages}):`,
            reply_markup: {
                inline_keyboard: keyboard
            }
        };

        if (messageId) {
            const editBody = { ...requestBody, message_id: messageId };
            await editMessage(JSON.stringify(editBody));
        } else {
            await sendMessage(JSON.stringify(requestBody));
        }
    } catch (error) {
        logger.error('Error handling subscribe command:', error);
        await sendCommonTextMessage(chatId, 'Error loading subscriptions.');
    }
}

export function renderSubscribeKeyboard(subscriptions: SubscriptionDataDto[], teleUserId: string, currentPage: number, totalPages: number): InlineKeyboardButton[][] {
    const keyboard: InlineKeyboardButton[][] = [];

    for (const sub of subscriptions) {
        keyboard.push([{
            text: sub.Keyword,
            callback_data: `subscribe:sub_detail:${sub.Keyword}:0` // Add initial page 0
        }]);
    }

    const navRow: InlineKeyboardButton[] = [];
    if (currentPage > 0) {
        navRow.push({
            text: 'Previous Page',
            callback_data: `subscribe:sub_prev:${teleUserId}:${currentPage}`
        });
    }
    if (currentPage < totalPages - 1) {
        navRow.push({
            text: 'Next Page',
            callback_data: `subscribe:sub_next:${teleUserId}:${currentPage}`
        });
    }
    if (navRow.length > 0) {
        keyboard.push(navRow);
    }

    return keyboard;
}

async function showSubscriptionDetailPage(chatId: number, teleUserId: string, keyword: string, page: number, messageId?: number): Promise<void> {
    try {
        const userInfo = await getUserInfoByTelegramId(teleUserId);
        const subDetail = await queryUserKeywordSubscriptionDetail(userInfo.userId, keyword);
        
        const offset = page * SUBSCRIBE_DETAIL_PAGE_SIZE;
        const [feedItems, totalCount] = await queryKeywordSubscriptionFeedItemList(userInfo.userId, keyword, subDetail.Source, subDetail.Country, subDetail.ExcludeFeedId, offset, SUBSCRIBE_DETAIL_PAGE_SIZE);

        const totalPages = Math.ceil(totalCount / SUBSCRIBE_DETAIL_PAGE_SIZE);

        if (page < 0 || (page >= totalPages && totalPages > 0)) {
            await sendCommonTextMessage(chatId, "You've reached the end of the list.");
            return;
        }

        if (totalCount === 0) {
            await sendCommonTextMessage(chatId, `No feed items found for subscription: ${keyword}`);
            return;
        }

        const { text, keyboard } = renderSubscribeDetailKeyboard(feedItems, keyword, page, totalPages, teleUserId);
        
        const requestBody = {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: keyboard
            }
        };

        if (messageId) {
            const editBody = { ...requestBody, message_id: messageId };
            await editMessage(JSON.stringify(editBody));
        } else {
            await sendMessage(JSON.stringify(requestBody));
        }

    } catch (error) {
        logger.error(`Error fetching subscription detail for ${keyword}:`, error);
        await sendCommonTextMessage(chatId, `Error fetching details for: ${keyword}`);
    }
}

export async function handleSubscribeCallbackQuery(chatId: number, messageId: number, data: string, teleUserId: string): Promise<void> {
    if (!data.startsWith('subscribe:')) return;

    const parts = data.split(':');
    const command = parts[0]; // 'subscribe'
    const action = parts[1];
    const payload = parts.slice(2);

    if (action === 'sub_prev' || action === 'sub_next') {
        const [teleUserId, currentPageStr] = payload;
        const currentPage = parseInt(currentPageStr);
        const newPage = action === 'sub_prev' ? currentPage - 1 : currentPage + 1;
        await handleSubscribeCommand(chatId, teleUserId, newPage, messageId);
    } else if (action === 'sub_detail' || action === 'sub_detail_prev' || action === 'sub_detail_next') {
        const [keyword, currentPageStr] = payload;
        const currentPage = parseInt(currentPageStr);
        let newPage = currentPage;

        if (action === 'sub_detail_prev') {
            newPage = currentPage - 1;
        } else if (action === 'sub_detail_next') {
            newPage = currentPage + 1;
        }
        
        await showSubscriptionDetailPage(chatId, teleUserId, keyword, newPage, messageId);
    } else if (action === 'sub_back_to_list') {
        const [teleUserIdFromPayload, pageStr] = payload; // pageStr should be '0'
        await handleSubscribeCommand(chatId, teleUserIdFromPayload, parseInt(pageStr), messageId); // Go back to page 0 of subscriptions
    } else if (action === 'sub_item_detail_back') {
        const [keyword, currentPageStr] = payload;
        const currentPage = parseInt(currentPageStr);
        await showSubscriptionDetailPage(chatId, teleUserId, keyword, currentPage, messageId);
    } else if (action === 'sub_item_detail') {
        const [shortId, keyword, currentPageStr] = payload;
        const mapping = subscriptionDetailMap.get(shortId);

        if (!mapping) {
            await sendCommonTextMessage(chatId, 'Episode details not found. Please try again.');
            return;
        }

        try {
            // const { podcast, episode } = await getPodcastEpisodeInfo(mapping.feedId, mapping.guid);
            const episode = await getSpotifyEpisodeDetail(mapping.guid);
            const podcast = await getSpotifyShowDetail(episode.ChannelId);
            const { text, keyboard } = renderEpisodeDetailKeyboard(episode, podcast, keyword, parseInt(currentPageStr), SUBSCRIBE_COMMAND, 'sub_item_detail');

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
            logger.error('Error fetching subscribed episode details:', error);
            await sendCommonTextMessage(chatId, 'Error loading episode details.');
        } finally {
            subscriptionDetailMap.delete(shortId);
        }
    } else if (action === 'sub_item_detail_play') {
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

            logger.debug(`Sending audio to chat ${chatId} with URL: ${audioInfo.url} and title: ${audioInfo.title}`);
            await sendAudio(chatId, audioInfo.url, audioInfo.title, audioInfo.podcast);
        } catch (error) {
            logger.error('Error playing audio:', error);
            await sendCommonTextMessage(chatId, 'Error playing audio. The audio file may be unavailable.');
        }
    }
}

export function renderSubscribeDetailKeyboard(feedItems: FeedItem[], keyword: string, currentPage: number, totalPages: number, teleUserId: string): RenderedDetail {
    let html = `<b>Recent episodes for "${keyword}":</b>\n\n`;
    const keyboard: InlineKeyboardButton[][] = [];

    for (const item of feedItems) {
        const shortId = crypto.randomUUID().substring(0, 8);
        subscriptionDetailMap.set(shortId, { feedId: String(item.FeedId), guid: item.GUID });

        keyboard.push([{
            text: item.Title,
            callback_data: `subscribe:sub_item_detail:${shortId}:${keyword}:${currentPage}`
        }]);
    }

    // Add the 'Back to Subscriptions' button row
    keyboard.push([{
        text: 'Back to Subscriptions',
        callback_data: `subscribe:sub_back_to_list:${teleUserId}:0`
    }]);

    const navRow: InlineKeyboardButton[] = [];

    if (currentPage > 0) {
        navRow.push({
            text: 'Previous',
            callback_data: `subscribe:sub_detail_prev:${keyword}:${currentPage}`
        });
    }
    if (currentPage < totalPages - 1) {
        navRow.push({
            text: 'Next',
            callback_data: `subscribe:sub_detail_next:${keyword}:${currentPage}`
        });
    }
    if (navRow.length > 0) {
        keyboard.push(navRow);
    }

    return { text: html, keyboard: keyboard };
}
