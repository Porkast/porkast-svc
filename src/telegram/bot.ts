import type { FeedItem } from "../models/feeds";
import { logger } from "../utils/logger";
import { BotCommands } from "./bot.types";

export async function SetBotCommands(botToken: string) {
    const setCommandsUrl = `https://api.telegram.org/bot${botToken}/setMyCommands`;
    try {
        const response = await fetch(setCommandsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commands: BotCommands }),
        });
        const data = await response.json() as any;
        if (data.ok) {
            logger.info('Telegram bot commands set successfully');
        } else {
            logger.error('Telegram bot commands set failed:', data.description);
        }
    } catch (error) {
        logger.error('Error setting bot commands:', error);
    }
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function sendSubscriptionNewUpdateMessage(
    botToken: string,
    miniAppLink: string,
    chatId: string,
    keyword: string,
    updateCount: number,
    feedItemList: FeedItem[],
    link: string
) {
    let updatePodcastInfoStr = ''
    const inlineKeyboard: { text: string; web_app?: { url: string }; url?: string }[][] = []
    let currentRow: { text: string; web_app: { url: string } }[] = []

    for (let i = 0; i < feedItemList.length; i++) {
        const porkastItemUrl = miniAppLink + `/podcast/${feedItemList[i].FeedId}/episode/${feedItemList[i].GUID}`
        const escapedTitle = escapeHtml(feedItemList[i].Title)
        updatePodcastInfoStr += `${i + 1}. ${escapedTitle}\n`

        currentRow.push({ text: String(i + 1), web_app: { url: porkastItemUrl } })

        if (currentRow.length === 5) {
            inlineKeyboard.push(currentRow)
            currentRow = []
        }
    }

    if (currentRow.length > 0) {
        inlineKeyboard.push(currentRow)
    }

    inlineKeyboard.push([{ text: 'Check Now', web_app: { url: link } }])

    const message = `
#${keyword} has been updated, ${updateCount} new episodes were added, click to check it out.

${updatePodcastInfoStr}

`
    sendMessage(botToken, JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard }
    }))
}

export async function sendCommonTextMessage(botToken: string, chatId: number, text: string) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text }),
        });
        const data = await response.json() as any;
        if (!data.ok) {
            logger.error('Send message failed:', data.description);
        }
    } catch (error) {
        logger.error('Error sending message:', error);
    }
}

export async function sendMessage(botToken: string, body: string) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body
        });
        const data = await response.json() as any;
        if (!data.ok) {
            logger.error('Send message failed:', data.description);
        }
    } catch (error) {
        logger.error('Error sending message:', error);
    }
}

export async function answerCallbackQuery(botToken: string, callbackQueryId: string, text: string = '') {
    const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
        });
        const data = await response.json() as any;
        if (!data.ok) {
            logger.error('Answer callback query failed:', data.description);
        }
    } catch (error) {
        logger.error('Error answering callback query:', error);
    }
}

export async function editMessage(botToken: string, body: string) {
    const url = `https://api.telegram.org/bot${botToken}/editMessageText`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body
        });
        const data = await response.json() as any;
        if (!data.ok) {
            logger.error('Edit message failed:', data.description);
        }
    } catch (error) {
        logger.error('Error editing message:', error);
    }
}

export async function sendAudio(botToken: string, chatId: number, audioUrl: string, title: string = '', performer: string = '') {
    const url = `https://api.telegram.org/bot${botToken}/sendAudio`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                audio: audioUrl,
                caption: title,
                performer: performer,
            }),
        });
        const data = await response.json() as any;
        if (!data.ok) {
            logger.error('Send audio failed:', data.description);
        }
    } catch (error) {
        logger.error('Error sending audio:', error);
    }
}
