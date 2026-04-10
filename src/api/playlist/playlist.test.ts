import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { createPlaylist, getPlaylistPodcastList } from './playlist';
import { UserPlaylistItemDto } from '../../models/playlist';
import { UserInfo } from '../user/types';
import { decodeDatabaseText } from '../../utils/text';

const prismaMock = {
    user_playlist: {
        create: mock(),
        findFirst: mock(),
    },
    user_playlist_item: {
        findFirst: mock(),
    },
    user_info: {
        findFirst: mock(),
    },
};

const playlistItemsMock = mock(async () => []);

mock.module('../../db/prisma.client', () => ({
    default: prismaMock,
}));

mock.module('../../utils/common', () => ({
    generatePlaylistId: mock((playlistName: string, userId: string) => `mock-id-${playlistName}-${userId}`),
}));

mock.module('../../db/playlist', () => ({
    queryPlaylistItemsByPlaylistId: playlistItemsMock,
}));

describe('createPlaylist()', () => {
    beforeEach(() => {
        prismaMock.user_playlist.create.mockReset();
        prismaMock.user_playlist_item.findFirst.mockReset();
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

describe('getPlaylistPodcastList()', () => {
    beforeEach(() => {
        prismaMock.user_playlist.findFirst.mockReset();
        prismaMock.user_playlist_item.findFirst.mockReset();
        prismaMock.user_info.findFirst.mockReset();
        playlistItemsMock.mockReset();
    });

    const mockUserInfo: UserInfo = {
        userId: '123',
        nickname: 'testuser',
        email: 'test@example.com',
        phone: '',
        avatar: '',
        regDate: new Date(),
        updateDate: new Date(),
        password: '',
        telegramId: ''
    };

    const mockPlaylistItem: UserPlaylistItemDto = {
        Id: 'item1',
        PlaylistId: 'playlist1',
        FeedId: 'feed1',
        GUID: 'guid1',
        ChannelId: 'channel1',
        Title: 'Test Episode',
        HighlightTitle: 'Test Episode',
        Link: '',
        PubDate: new Date().toISOString(),
        Author: '',
        InputDate: new Date().toISOString(),
        ImageUrl: '',
        EnclosureUrl: '',
        EnclosureType: '',
        EnclosureLength: '',
        Duration: '0',
        Episode: '',
        Explicit: '',
        Season: '',
        EpisodeType: '',
        Description: 'Test description',
        TextDescription: 'Test description',
        ChannelImageUrl: '',
        ChannelTitle: 'Test Channel',
        HighlightChannelTitle: 'Test Channel',
        FeedLink: '',
        Count: 1,
        Source: 'itunes',
        ExcludeFeedId: '',
        Country: 'US',
        TookTime: 0,
        HasThumbnail: true,
        RegDate: new Date().toISOString(),
        Status: 1,
    };

    it('should return playlist and user info when playlist exists and belongs to user', async () => {
        prismaMock.user_playlist.findFirst.mockResolvedValue({
            id: 'playlist1',
            user_id: '123'
        });
        prismaMock.user_playlist_item.findFirst.mockResolvedValue({
            playlist_id: 'playlist1'
        });
        prismaMock.user_info.findFirst.mockResolvedValue({
            id: '123',
            nickname: 'testuser',
            email: 'test@example.com',
            reg_date: new Date(),
            update_date: new Date()
        });
        playlistItemsMock.mockResolvedValue([mockPlaylistItem]);

        const result = await getPlaylistPodcastList('123', 'playlist1', '10', '0');

        expect(result.userInfo).toMatchObject({
            userId: '123',
            nickname: 'testuser',
            email: 'test@example.com'
        });
        expect(result.playlist[0]).toMatchObject({
            Id: 'item1',
            PlaylistId: 'playlist1',
            Title: 'Test Episode',
            Description: 'Test description'
        });
        expect(result.playlist).toHaveLength(1);
        expect(playlistItemsMock).toHaveBeenCalledWith('playlist1', 0, 10);
    });

    it('passes offset and limit through to the playlist query', async () => {
        prismaMock.user_playlist_item.findFirst.mockResolvedValue({
            playlist_id: 'playlist1'
        });
        prismaMock.user_info.findFirst.mockResolvedValue({
            id: '123',
            nickname: 'testuser',
            email: 'test@example.com',
            reg_date: new Date(),
            update_date: new Date()
        });
        playlistItemsMock.mockResolvedValue([mockPlaylistItem]);

        await getPlaylistPodcastList('123', 'playlist1', '5', '15');

        expect(playlistItemsMock).toHaveBeenCalledWith('playlist1', 15, 5);
    });

    it('should throw error when playlist not found', async () => {
        prismaMock.user_playlist_item.findFirst.mockResolvedValue(null);

        await expect(getPlaylistPodcastList('123', 'nonexistent', '10', '0'))
            .rejects.toThrow('Playlist not found');
    });

    it('should throw error when playlist belongs to different user', async () => {
        prismaMock.user_playlist_item.findFirst.mockResolvedValue({
            playlist_id: 'playlist1'
        });
        prismaMock.user_info.findFirst.mockResolvedValue(null);

        await expect(getPlaylistPodcastList('123', 'playlist1', '10', '0'))
            .rejects.toThrow('User not found');
    });

    it('should throw error when user not found', async () => {
        prismaMock.user_playlist_item.findFirst.mockResolvedValue({
            playlist_id: 'playlist1'
        });
        prismaMock.user_info.findFirst.mockResolvedValue(null);

        await expect(getPlaylistPodcastList('123', 'playlist1', '10', '0'))
            .rejects.toThrow('User not found');
    });

    it('should return empty playlist when no items exist', async () => {
        prismaMock.user_playlist_item.findFirst.mockResolvedValue({
            playlist_id: 'playlist1'
        });
        prismaMock.user_info.findFirst.mockResolvedValue({
            id: '123',
            nickname: 'testuser',
            email: 'test@example.com',
            reg_date: new Date(),
            update_date: new Date()
        });
        playlistItemsMock.mockResolvedValue([]);

        const result = await getPlaylistPodcastList('123', 'playlist1', '10', '0');

        expect(result.playlist).toEqual([]);
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

describe('decodeDatabaseText() in playlist responses', () => {
    it('decodes playlist descriptions as utf-8', () => {
        const description = Buffer.from('黑神话', 'utf8')

        expect(decodeDatabaseText(description)).toBe('黑神话')
    })
})
