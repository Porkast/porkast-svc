import { v5 as uuidv5 } from 'uuid';
import { v4 as uuidv4 } from 'uuid';

export const convertMillsTimeToDuration = (mills: number): string => {
    // Check if the duration is in the thousands digits
    if (mills >= 1000 && mills < 10000) {
        // Convert to milliseconds
        mills *= 1000;
    }

    // Convert milliseconds to duration time with format 00:00:00
    const hours = Math.floor(mills / 3600000);
    const minutes = Math.floor((mills % 3600000) / 60000);
    const seconds = Math.floor(((mills % 3600000) % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export const generateFeedItemId = async (feedUrl: string, title: string): Promise<string> => {
    const uniqueId = uuidv5(feedUrl + title, uuidv5.DNS);
    return uniqueId
}

export const formatDateTime = (dateTime: string): string => {
    const date = new Date(dateTime)
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
}

export const getNickname = (email: string, nickname: string): string => {
    if (!nickname) {
        nickname = email.split('@')[0]
    }
    return nickname
}

