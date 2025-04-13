
interface TelegramBotChatData {
    messageId: number
    from: {
        id: number
        firstName: string
        lastName: string
        username: string
        type: string
        text: string
    }
    repsonse: {
        id: number
        firstName: string
        lastName: string
        username: string
        type: string
        text: string
    }
    date: number
}