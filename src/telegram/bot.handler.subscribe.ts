import { sendCommonTextMessage, sendMessage, editMessage } from './bot';
import { queryUserKeywordSubscriptionList, queryUserKeywordSubscriptionDetail, queryKeywordSubscriptionFeedItemList } from '../db/subscription';
import { SubscriptionDataDto } from '../models/subscription';
import { getUserInfoByTelegramId } from '../db/user';
import { FeedItem } from '../models/feeds';
import { InlineKeyboardButton, RenderedDetail } from './types';

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
        console.error('Error handling subscribe command:', error);
        await sendCommonTextMessage(chatId, 'Error loading subscriptions.');
    }
}

export function renderSubscribeKeyboard(subscriptions: SubscriptionDataDto[], teleUserId: string, currentPage: number, totalPages: number): InlineKeyboardButton[][] {
    const keyboard: InlineKeyboardButton[][] = [];

    for (const sub of subscriptions) {
        keyboard.push([{
            text: sub.Keyword,
            callback_data: `sub_detail:subscribe:${sub.Keyword}:0` // Add initial page 0
        }]);
    }

    const navRow: InlineKeyboardButton[] = [];
    if (currentPage > 0) {
        navRow.push({
            text: 'Previous Page',
            callback_data: `sub_prev:subscribe:${teleUserId}:${currentPage}`
        });
    }
    if (currentPage < totalPages - 1) {
        navRow.push({
            text: 'Next Page',
            callback_data: `sub_next:subscribe:${teleUserId}:${currentPage}`
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
        console.error(`Error fetching subscription detail for ${keyword}:`, error);
        await sendCommonTextMessage(chatId, `Error fetching details for: ${keyword}`);
    }
}

export async function handleSubscribeCallbackQuery(chatId: number, messageId: number, data: string, teleUserId: string): Promise<void> {
    if (!data.startsWith('sub_')) return;

    const parts = data.split(':');
    const action = parts[0];
    const command = parts[1]; // 'subscribe'
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
        await handleSubscribeCommand(chatId, teleUserIdFromPayload, 0, messageId); // Go back to page 0 of subscriptions
    }
}

export function renderSubscribeDetailKeyboard(feedItems: FeedItem[], keyword: string, currentPage: number, totalPages: number, teleUserId: string): RenderedDetail {
    let html = `<b>Recent episodes for "${keyword}":</b>\n\n`;
    const offset = currentPage * SUBSCRIBE_DETAIL_PAGE_SIZE;

    feedItems.forEach((item, index) => {
        const itemNumber = offset + index + 1;
        const title = item.Title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const porkastItemLink = `${process.env.PORKAST_WEB_BASE_URL}/podcast/${item.FeedId}/episode/${item.GUID}`;
        html += `${itemNumber}. <a href="${porkastItemLink}">${title}</a>\n`;
    });

    const keyboard: InlineKeyboardButton[][] = [];

    // Add the 'Back to Subscriptions' button row
    keyboard.push([{
        text: 'Back to Subscriptions',
        callback_data: `sub_back_to_list:subscribe:${teleUserId}:0`
    }]);

    const navRow: InlineKeyboardButton[] = [];

    if (currentPage > 0) {
        navRow.push({
            text: 'Previous',
            callback_data: `sub_detail_prev:subscribe:${keyword}:${currentPage}`
        });
    }
    if (currentPage < totalPages - 1) {
        navRow.push({
            text: 'Next',
            callback_data: `sub_detail_next:subscribe:${keyword}:${currentPage}`
        });
    }
    if (navRow.length > 0) {
        keyboard.push(navRow);
    }

    return { text: html, keyboard: keyboard };
}