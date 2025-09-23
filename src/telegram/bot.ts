import { FeedItem } from "../models/feeds";
import { BOT_TOKEN } from "./bot.setup";
import { BotCommands } from "./bot.types";


export async function SetBotCommands() {
    const setCommandsUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`;
    try {
        const response = await fetch(setCommandsUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                commands: BotCommands,
            }),
        });

        const data = await response.json();
        if (data.ok) {
            console.log('Telegram bot commands set successfully:', data);
        } else {
            console.error('Telegram bot commands set failed:', data.description);
        }
    } catch (error) {
        console.error('Error setting bot commands:', error);
    }
}

function escapeMarkdownV2(text: string): string {
    // List of characters that need to be escaped in Telegram MarkdownV2
    const escapeChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];

    // Escape each character in the text
    const escapedText = text.split('').map(char => {
        if (escapeChars.includes(char)) {
            return `\\${char}`;
        } else {
            return char;
        }
    }).join('');

    return escapedText;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#39;');
}

export function sendSubscriptionNewUpdateMessage(
    chatId: string,
    keyword: string,
    updateCount: number,
    feedItemList: FeedItem[],
    link: string
) {
    var updatePodcastInfoStr = ''
    for (let i = 0; i < feedItemList.length; i++) {
        const porkastItemUrl = process.env.PORKAST_WEB_BASE_URL + `/podcast/${feedItemList[i].FeedId}/episode/${feedItemList[i].GUID}`
        const escapedTitle = escapeHtml(feedItemList[i].Title)
        updatePodcastInfoStr += `${i + 1}. <a href="${porkastItemUrl}">${escapedTitle}</a>\n`
    }
    var message = `
#${keyword} has been updated, ${updateCount} new episodes were added, click to check it out.

${updatePodcastInfoStr}

`
    const requestBody = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Check Now', url: link }
                ]
            ]
        }
    };
    sendMessage(JSON.stringify(requestBody))
}

export async function sendCommonTextMessage(chatId: number, text: string) {
    if (!BOT_TOKEN) {
        console.error('TELEGRAM_BOT_TOKEN is not set, cannot send message.');
        return;
    }
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
            }),
        });
        const data = await response.json();
        if (!data.ok) {
            console.error('Send message failed:', data.description);
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

export async function sendMessage(body: string) {
    if (!BOT_TOKEN) {
        console.error('TELEGRAM_BOT_TOKEN is not set, cannot send message.');
        return;
    }
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: body
        });
        const data = await response.json();
        if (!data.ok) {
            console.error('Send message failed:', data.description);
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

export async function answerCallbackQuery(callbackQueryId: string, text: string = '') {
    if (!BOT_TOKEN) {
        console.error('TELEGRAM_BOT_TOKEN is not set, cannot answer callback query.');
        return;
    }
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                callback_query_id: callbackQueryId,
                text: text,
            }),
        });
        const data = await response.json();
        if (!data.ok) {
            console.error('Send message failed:', data.description);
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

export async function editMessage(body: string) {
    if (!BOT_TOKEN) {
        console.error('TELEGRAM_BOT_TOKEN is not set, cannot send message.');
        return;
    }
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: body
        });
        const data = await response.json();
        if (!data.ok) {
            console.error('Send message failed:', data.description);
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

export async function sendAudio(chatId: number, audioUrl: string, title: string = '', performer: string = '') {
    if (!BOT_TOKEN) {
        console.error('TELEGRAM_BOT_TOKEN is not set, cannot send audio.');
        return;
    }
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendAudio`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                audio: audioUrl,
                caption: title,
                performer: performer,
            }),
        });
        const data = await response.json();
        if (!data.ok) {
            console.error('Send audio failed:', data.description);
        }
    } catch (error) {
        console.error('Error sending audio:', error);
    }
}
