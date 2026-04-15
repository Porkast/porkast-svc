import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { addPodcastToPlaylist, createPlaylist, getPlaylistPodcastList } from './playlist';
import { FeedItem } from '../../models/feeds';
import { UserPlaylistItemDto } from '../../models/playlist';
import { UserInfo } from '../user/types';
import { decodeDatabaseText } from '../../utils/text';

const prismaMock = {
    user_playlist: {
        create: mock(),
    },
    user_playlist_item: {
        findFirst: mock(),
        findUnique: mock(),
        create: mock(),
    },
    user_info: {
        findFirst: mock(),
    },
};

const playlistItemsMock = mock(async () => []);
const queryPlaylistByPlaylistIdMock = mock();
const queryUserPlaylistListByUserIdMock = mock(async () => []);
const getFeedItemByIdentifiersMock = mock();
const createOrUpdateFeedItemMock = mock();
const generatePlaylistIdMock = mock((playlistName: string, userId: string) => `mock-id-${playlistName}-${userId}`);
const generatePlaylistItemIdMock = mock();
const generateFeedItemIdMock = mock();
const getPodcastEpisodeInfoMock = mock();
const getSpotifyEpisodeDetailMock = mock();

mock.module('../../db/prisma.client', () => ({
    default: prismaMock,
}));

mock.module('../../utils/common', () => ({
    generatePlaylistId: generatePlaylistIdMock,
    generatePlaylistItemId: generatePlaylistItemIdMock,
    generateFeedItemId: generateFeedItemIdMock,
}));

mock.module('../../db/playlist', () => ({
    queryPlaylistItemsByPlaylistId: playlistItemsMock,
    queryPlaylistByPlaylistId: queryPlaylistByPlaylistIdMock,
    queryUserPlaylistListByUserId: queryUserPlaylistListByUserIdMock,
}));

mock.module('../../db/feed_item', () => ({
    getFeedItemByIdentifiers: getFeedItemByIdentifiersMock,
    createOrUpdateFeedItem: createOrUpdateFeedItemMock,
}));

mock.module('../../utils/itunes', () => ({
    getPodcastEpisodeInfo: getPodcastEpisodeInfoMock,
}));

mock.module('../../utils/spotify', () => ({
    getSpotifyEpisodeDetail: getSpotifyEpisodeDetailMock,
}));

describe('createPlaylist()', () => {
    beforeEach(() => {
        prismaMock.user_playlist.create.mockReset();
        generatePlaylistIdMock.mockClear();
    });

    it('creates a new playlist when user provides valid data', async () => {
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

    it('returns Done when playlist creation is successful', async () => {
        const result = await createPlaylist('123', 'My Playlist', 'This is my playlist');

        expect(result).toBe('Done');
    });

    it('returns Something went wrong when playlist creation fails', async () => {
        prismaMock.user_playlist.create.mockRejectedValue(new Error('Mock error'));

        const result = await createPlaylist('123', 'My Playlist', 'This is my playlist');

        expect(result).toBe('Something went wrong');
    });
});

describe('addPodcastToPlaylist()', () => {
    const mockFeedItem: FeedItem = {
        Id: 'episode456',
        FeedId: 'podcast789',
        GUID: 'episode456',
        ChannelId: 'podcast789',
        Title: 'Test Episode',
        HighlightTitle: 'Test Episode',
        Link: 'https://example.com/episode',
        PubDate: '2024-01-01',
        Author: 'Test Author',
        InputDate: new Date('2024-01-01'),
        ImageUrl: 'https://example.com/image.jpg',
        EnclosureUrl: 'https://example.com/audio.mp3',
        EnclosureType: 'audio/mpeg',
        EnclosureLength: '3600000',
        Duration: '01:00:00',
        Episode: '1',
        Explicit: 'false',
        Season: '1',
        EpisodeType: 'full',
        Description: 'Test episode description',
        TextDescription: 'Test episode description',
        ChannelImageUrl: 'https://example.com/channel.jpg',
        ChannelTitle: 'Test Podcast',
        HighlightChannelTitle: 'Test Podcast',
        FeedLink: 'https://example.com/feed.rss',
        Count: 1,
        Source: '',
        ExcludeFeedId: '',
        Country: 'US',
        TookTime: 0,
        HasThumbnail: false,
    };

    beforeEach(() => {
        queryPlaylistByPlaylistIdMock.mockReset();
        getFeedItemByIdentifiersMock.mockReset();
        createOrUpdateFeedItemMock.mockReset();
        generatePlaylistItemIdMock.mockReset();
        generateFeedItemIdMock.mockReset();
        getPodcastEpisodeInfoMock.mockReset();
        getSpotifyEpisodeDetailMock.mockReset();
        prismaMock.user_playlist_item.findUnique.mockReset();
        prismaMock.user_playlist_item.create.mockReset();
    });

    it('reuses stored feed items and preserves xmly source', async () => {
        queryPlaylistByPlaylistIdMock.mockResolvedValue({ id: 'playlist1' });
        getFeedItemByIdentifiersMock.mockResolvedValue(mockFeedItem);
        generateFeedItemIdMock.mockResolvedValue('generated-feed-item-id');
        generateFeedItemIdMock.mockResolvedValueOnce('generated-channel-id');
        generatePlaylistItemIdMock.mockResolvedValue('playlist-item-id');
        prismaMock.user_playlist_item.findUnique.mockResolvedValue(null);
        prismaMock.user_playlist_item.create.mockResolvedValue({} as any);

        const result = await addPodcastToPlaylist('playlist1', 'internal-channel-id', 'xmly', 'xmly_track_123');

        expect(result).toBe('Done');
        expect(getPodcastEpisodeInfoMock).not.toHaveBeenCalled();
        expect(getSpotifyEpisodeDetailMock).not.toHaveBeenCalled();
        expect(createOrUpdateFeedItemMock).toHaveBeenCalledWith(expect.objectContaining({ Source: 'xmly' }));
    });

    it('rejects unknown sources when no stored feed item exists', async () => {
        queryPlaylistByPlaylistIdMock.mockResolvedValue({ id: 'playlist1' });
        getFeedItemByIdentifiersMock.mockResolvedValue(null);

        await expect(addPodcastToPlaylist('playlist1', 'internal-channel-id', 'xmly', 'xmly_track_123'))
            .rejects.toThrow('Podcast Episode not found');
    });
});

describe('getPlaylistPodcastList()', () => {
    const mockUserInfo: UserInfo = {
        userId: '123',
        nickname: 'testuser',
        email: 'test@example.com',
        phone: '',
        avatar: '',
        regDate: new Date(),
        updateDate: new Date(),
        password: '',
        telegramId: '',
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

    beforeEach(() => {
        prismaMock.user_playlist_item.findFirst.mockReset();
        prismaMock.user_info.findFirst.mockReset();
        playlistItemsMock.mockReset();
    });

    it('returns playlist and user info when playlist exists and belongs to user', async () => {
        prismaMock.user_playlist_item.findFirst.mockResolvedValue({
            playlist_id: 'playlist1',
        });
        prismaMock.user_info.findFirst.mockResolvedValue({
            id: '123',
            nickname: 'testuser',
            email: 'test@example.com',
            reg_date: new Date(),
            update_date: new Date(),
        });
        playlistItemsMock.mockResolvedValue([mockPlaylistItem]);

        const result = await getPlaylistPodcastList('123', 'playlist1', '10', '0');

        expect(result.userInfo).toMatchObject({
            userId: '123',
            nickname: 'testuser',
            email: 'test@example.com',
        });
        expect(result.playlist[0]).toMatchObject({
            Id: 'item1',
            PlaylistId: 'playlist1',
            Title: 'Test Episode',
            Description: 'Test description',
        });
        expect(result.playlist).toHaveLength(1);
        expect(playlistItemsMock).toHaveBeenCalledWith('playlist1', 0, 10);
    });

    it('passes offset and limit through to the playlist query', async () => {
        prismaMock.user_playlist_item.findFirst.mockResolvedValue({
            playlist_id: 'playlist1',
        });
        prismaMock.user_info.findFirst.mockResolvedValue({
            id: '123',
            nickname: 'testuser',
            email: 'test@example.com',
            reg_date: new Date(),
            update_date: new Date(),
        });
        playlistItemsMock.mockResolvedValue([mockPlaylistItem]);

        await getPlaylistPodcastList('123', 'playlist1', '5', '15');

        expect(playlistItemsMock).toHaveBeenCalledWith('playlist1', 15, 5);
    });

    it('throws error when playlist not found', async () => {
        prismaMock.user_playlist_item.findFirst.mockResolvedValue(null);

        await expect(getPlaylistPodcastList('123', 'nonexistent', '10', '0'))
            .rejects.toThrow('Playlist not found');
    });

    it('throws error when user not found', async () => {
        prismaMock.user_playlist_item.findFirst.mockResolvedValue({
            playlist_id: 'playlist1',
        });
        prismaMock.user_info.findFirst.mockResolvedValue(null);

        await expect(getPlaylistPodcastList('123', 'playlist1', '10', '0'))
            .rejects.toThrow('User not found');
    });

    it('returns empty playlist when no items exist', async () => {
        prismaMock.user_playlist_item.findFirst.mockResolvedValue({
            playlist_id: 'playlist1',
        });
        prismaMock.user_info.findFirst.mockResolvedValue({
            id: '123',
            nickname: 'testuser',
            email: 'test@example.com',
            reg_date: new Date(),
            update_date: new Date(),
        });
        playlistItemsMock.mockResolvedValue([]);

        const result = await getPlaylistPodcastList('123', 'playlist1', '10', '0');

        expect(result.playlist).toEqual([]);
    });
});

describe('decodeDatabaseText() in playlist responses', () => {
    it('decodes playlist descriptions as utf-8', () => {
        const description = Buffer.from('黑神话', 'utf8');

        expect(decodeDatabaseText(description)).toBe('黑神话');
    });
});
