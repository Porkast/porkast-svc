import { sendCommonTextMessage, sendMessage } from './bot';
import { queryUserKeywordSubscriptionList } from '../db/subscription';
import { SubscriptionDataDto } from '../models/subscription';

const SUBSCRIBE_PAGE_SIZE = 5;

export async function handleSubscribeCommand(chatId: number, userId: string, page: number) {
    try {
        const offset = page * SUBSCRIBE_PAGE_SIZE;
        const subscriptions = await queryUserKeywordSubscriptionList(userId, offset, SUBSCRIBE_PAGE_SIZE);

        if (subscriptions.length === 0) {
            await sendCommonTextMessage(chatId, 'You have no subscriptions yet.');
            return;
        }

        const totalCount = subscriptions[0]?.Count || 0;
        const totalPages = Math.ceil(totalCount / SUBSCRIBE_PAGE_SIZE);

        const keyboard = renderSubscribeKeyboard(subscriptions, userId, page, totalPages);

        const requestBody = {
            chat_id: chatId,
            text: `Your subscriptions (Page ${page + 1}/${totalPages}):`,
            reply_markup: {
                inline_keyboard: keyboard
            }
        };

        await sendMessage(JSON.stringify(requestBody));
    } catch (error) {
        console.error('Error handling subscribe command:', error);
        await sendCommonTextMessage(chatId, 'Error loading subscriptions.');
    }
}

export function renderSubscribeKeyboard(subscriptions: SubscriptionDataDto[], userId: string, currentPage: number, totalPages: number) {
    const keyboard = [];

    // Add subscription buttons
    for (const sub of subscriptions) {
        keyboard.push([{
            text: sub.Keyword,
            callback_data: `sub_detail:${userId}:${sub.Keyword}:${currentPage}`
        }]);
    }

    // Add navigation buttons
    const navRow = [];
    if (currentPage > 0) {
        navRow.push({
            text: 'Previous Page',
            callback_data: `sub_prev:${userId}:${currentPage}`
        });
    }
    if (currentPage < totalPages - 1) {
        navRow.push({
            text: 'Next Page',
            callback_data: `sub_next:${userId}:${currentPage}`
        });
    }
    if (navRow.length > 0) {
        keyboard.push(navRow);
    }

    return keyboard;
}

export async function handleSubscribeCallbackQuery(chatId: number, messageId: number, data: string) {
    if (!data.startsWith('sub_')) return;

    const parts = data.split(':');
    const action = parts[0];
    const userId = parts[1];

    if (action === 'sub_prev' || action === 'sub_next') {
        const currentPage = parseInt(parts[2]);
        const newPage = action === 'sub_prev' ? currentPage - 1 : currentPage + 1;
        await handleSubscribeCommand(chatId, userId, newPage);
    } else if (action === 'sub_detail') {
        const keyword = parts[2];
        // For now, just show a message. Can be extended to show subscription details
        await sendCommonTextMessage(chatId, `Subscription details for: ${keyword}`);
    }
}
