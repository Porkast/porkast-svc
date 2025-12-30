


// Define types for Telegram keyboard structures
export interface InlineKeyboardButton {
    text: string;
    callback_data?: string;
    url?: string;
    web_app?: {
        url: string;
    };
}

export interface RenderedDetail {
    text: string;
    keyboard: InlineKeyboardButton[][];
}
