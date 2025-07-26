import { Context, Telegraf } from "telegraf";
import { User } from "telegraf/types";

var telBot: Telegraf<Context>;
var botInfo: User

export function getBot() {
    if (telBot) {
        return telBot
    }
    telBot = new Telegraf(process.env.TELE_BOT_TOKEN || '')
    registerBotCommands()
    return telBot
}

function registerBotCommands() {
    telBot.start(async (ctx) => {
        const message = `Hi, this is Porkast bot for notify you about new episodes.`
        await ctx.reply(message)
    })
}

async function getBotInfo() {
    if (botInfo) {
        return botInfo
    }
    const me = await getBot().telegram.getMe();
    botInfo = me
    return botInfo
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
    getBot().telegram.sendMessage(
        chatId,
        message,
        {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Check Now', url: link }
                    ]
                ]
            }
        }
    )
}