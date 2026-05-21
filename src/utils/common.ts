export const convertMillsTimeToDuration = (mills: number): string => {
    if (mills >= 1000 && mills < 10000) {
        mills *= 1000;
    }

    const hours = Math.floor(mills / 3600000);
    const minutes = Math.floor((mills % 3600000) / 60000);
    const seconds = Math.floor(((mills % 3600000) % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

async function sha1Hex(input: string): Promise<string> {
    const data = new TextEncoder().encode(input)
    const hash = await crypto.subtle.digest('SHA-1', data)
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

export const generateFeedItemId = async (feedUrl: string, title: string): Promise<string> => {
    return sha1Hex(feedUrl + title)
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

export const generatePlaylistId = async (name: string, userId: string): Promise<string> => {
    return sha1Hex(name + userId)
}

export const generatePlaylistItemId = async (playlistId: string, itemId: string): Promise<string> => {
    return sha1Hex(playlistId + itemId)
}

export const generateID = async (): Promise<string> => {
    return crypto.randomUUID()
}
