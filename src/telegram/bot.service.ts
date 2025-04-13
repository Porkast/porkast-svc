import { Injectable } from "@nestjs/common";
import { InjectBot } from "nestjs-telegraf";
import { LimitedQueue } from "src/utils/queue";
import { Context, Telegraf } from "telegraf";
import { User } from "telegraf/typings/core/types/typegram";
import { Markup } from "telegraf/markup";


@Injectable()
export class TeleBotService {

    private botInfo: User
    private chatHistoryMap = new Map<string, LimitedQueue<TelegramBotChatData>>()


    constructor(
        @InjectBot()
        private readonly bot: Telegraf<Context>
    ) {

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

    sendSubscriptionNewUpdateMessage(
        chatId: string, 
        keyword: string,
        updateCount: number,
        titleList: string[],
        link: string
    ) {
        const message = `
#${keyword} has been updated, ${updateCount} new episodes were added, click to check it out.

${titleList.join('\n')}

${link}
        `
        this.bot.telegram.sendMessage(chatId, message)
    }


}