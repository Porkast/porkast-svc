import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { createPlaylist } from './playlist';

const prismaMock = {
    user_playlist: {
        create: mock(),
    },
};

mock.module('../../db/prisma.client', () => ({
    default: prismaMock,
}));

mock.module('../../utils/common', () => ({
    generatePlaylistId: mock((playlistName: string, userId: string) => `mock-id-${playlistName}-${userId}`),
}));

describe('createPlaylist()', () => {
    beforeEach(() => {
        prismaMock.user_playlist.create.mockReset();
    });

    it('should create a new playlist when user provides valid data', async () => {
        const userId = '123';
        const playlistName = 'My Playlist';
        const description = 'This is my playlist';

        await createPlaylist(userId, playlistName, description);

        expect(prismaMock.user_playlist.create).toHaveBeenCalledWith({
            data: {
                id: `mock-id-${playlistName}-${userId}`,
                user_id: userId,
                playlist_name: playlistName,
                description: Buffer.from(description),
            },
        });
    });

    it('should return "Done" when playlist creation is successful', async () => {
        const userId = '123';
        const playlistName = 'My Playlist';
        const description = 'This is my playlist';

        const result = await createPlaylist(userId, playlistName, description);

        expect(result).toBe('Done');
    });

    it('should return "Something went wrong" when playlist creation fails', async () => {
        const userId = '123';
        const playlistName = 'My Playlist';
        const description = 'This is my playlist';

        prismaMock.user_playlist.create.mockRejectedValue(new Error('Mock error'));

        const result = await createPlaylist(userId, playlistName, description);

        expect(result).toBe('Something went wrong');
    });
});