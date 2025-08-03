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

export function sendSubscriptionNewUpdateMessage(
    chatId: string,
    keyword: string,
    updateCount: number,
    titleList: string[],
    link: string
) {
    var titleStr = ''
    for (let i = 0; i < titleList.length; i++) {
        titleStr += `${i + 1}. ${titleList[i]}\n`
    }
    var message = `
#${keyword} has been updated, ${updateCount} new episodes were added, click to check it out.

${titleStr}

`
    message = escapeMarkdownV2(message)
    const requestBody = {
        chat_id: chatId,
        text: message,
        parse_mode: 'MarkdownV2',
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

export async function sendCommonTestMessage(chatId: number, text: string) {
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