import { Injectable, Logger } from "@nestjs/common";
import { LimitedQueue } from "src/utils/queue";
import { Context, Telegraf } from "telegraf";
import { User } from "telegraf/typings/core/types/typegram";


@Injectable()
export class TeleBotService {

    private readonly logger = new Logger(TeleBotService.name)
    private botInfo: User
    private chatHistoryMap = new Map<string, LimitedQueue<TelegramBotChatData>>()
    private readonly bot: Telegraf<Context>


    constructor() {
        this.bot = new Telegraf(process.env.TELE_BOT_TOKEN)
        this.registerBotCommands()
        this.bot.launch()
    }

    getBot(): Telegraf<Context> {
        return this.bot
    }

    async getBotInfo(): Promise<User> {
        if (this.botInfo) {
            return this.botInfo
        }
        const me = await this.bot.telegram.getMe();
        this.botInfo = me
        return this.botInfo
    }

    storeQueueChatHistory(message: TelegramBotChatData) {
        if (!this.chatHistoryMap.has(message.from.id.toString())) {
            this.chatHistoryMap.set(message.from.id.toString(), new LimitedQueue(6))
        }
        const chatHistory = this.chatHistoryMap.get(message.from.id.toString())
        chatHistory.enqueue(message)
    }

    getAllQueueChatHistory(chatId: string): TelegramBotChatData[] {
        if (this.chatHistoryMap.has(chatId)) {
            const chatHistory = this.chatHistoryMap.get(chatId)
            return chatHistory.getQueue()
        }
    }

    escapeMarkdownV2(text: string): string {
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

    sendSubscriptionNewUpdateMessage(
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
        var message =`
#${keyword} has been updated, ${updateCount} new episodes were added, click to check it out.

${titleStr}

`
        message = this.escapeMarkdownV2(message)
        this.bot.telegram.sendMessage(
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


    async registerBotCommands() {
        this.bot.start(async (ctx) => {
            this.logger.log(`Receive /start from ${ctx.from.username}`);
            const message = `Hi, this is Porkast bot for notify you about new episodes.`
            await ctx.reply(message)
        })
    }
}