import prisma from "../../db/prisma.client";
import { generatePlaylistId } from "../../utils/common";

export async function createPlaylist(userId: string, playlistName: string, description: string): Promise<String> {
    try {
        await prisma.user_playlist.create({
            data: {
                id: await generatePlaylistId(playlistName, userId),
                user_id: userId,
                playlist_name: playlistName,
                description: Buffer.from(description),
            }
        })
    } catch (error) {
        console.log('create playlist error', error)
        return 'Something went wrong'
    }

    return 'Done'
}