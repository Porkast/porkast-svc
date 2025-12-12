import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { addEpisodeToListenLater, getUserListenLaterList } from './listen_later';
import { AddPodcastToListenLaterRequest } from './types';
import { UserListenLaterDto } from '../../models/listen_later';
import { FeedItem } from '../../models/feeds';

const prismaMock = {
    user_listen_later: {
        findFirst: mock(),
        create: mock(),
        count: mock(),
    },
    $queryRaw: mock(),
};

const getPodcastEpisodeInfoMock = mock();
const createOrUpdateFeedItemMock = mock();
const generateFeedItemIdMock = mock();
const generateIDMock = mock();
const formatDateTimeMock = mock();
const queryUserListenLaterListMock = mock();
const queryUserListenLaterTotalCountMock = mock();

mock.module('../../db/prisma.client', () => ({
    default: prismaMock,
}));

mock.module('../../utils/itunes', () => ({
    getPodcastEpisodeInfo: getPodcastEpisodeInfoMock,
}));

mock.module('../../db/feed_item', () => ({
    createOrUpdateFeedItem: createOrUpdateFeedItemMock,
}));

mock.module('../../utils/common', () => ({
    generateFeedItemId: generateFeedItemIdMock,
    generateID: generateIDMock,
    formatDateTime: formatDateTimeMock,
}));

mock.module('../../db/listen_later', () => ({
    queryUserListenLaterList: queryUserListenLaterListMock,
    queryUserListenLaterTotalCount: queryUserListenLaterTotalCountMock,
}));

describe('addEpisodeToListenLater()', () => {
    beforeEach(() => {
        getPodcastEpisodeInfoMock.mockReset();
        createOrUpdateFeedItemMock.mockReset();
        prismaMock.user_listen_later.findFirst.mockReset();
        prismaMock.user_listen_later.create.mockReset();
        generateFeedItemIdMock.mockReset();
        generateIDMock.mockReset();
    });

    const mockRequest: AddPodcastToListenLaterRequest = {
        userId: 'user123',
        itemId: 'episode456',
        channelId: 'podcast789',
        source: 'itunes',
    };

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
        Source: 'itunes',
        ExcludeFeedId: '',
        Country: 'US',
        TookTime: 0,
        HasThumbnail: false,
    };

    it('should successfully add episode to listen later', async () => {
        // Mock podcast episode info
        getPodcastEpisodeInfoMock.mockResolvedValue({
            episode: mockFeedItem,
            podcast: {} as any
        });

        // Mock feed item ID generation
        generateFeedItemIdMock.mockResolvedValue('generated-feed-item-id');
        generateFeedItemIdMock.mockResolvedValueOnce('generated-channel-id');

        // Mock database checks - episode not already added
        prismaMock.user_listen_later.findFirst.mockResolvedValue(null);

        // Mock ID generation for new entry
        generateIDMock.mockResolvedValue('generated-id');

        // Mock successful creation
        prismaMock.user_listen_later.create.mockResolvedValue({} as any);

        const result = await addEpisodeToListenLater(mockRequest);

        expect(result).toBe('Done');
        expect(getPodcastEpisodeInfoMock).toHaveBeenCalledWith('podcast789', 'episode456');
        expect(createOrUpdateFeedItemMock).toHaveBeenCalled();
        expect(prismaMock.user_listen_later.create).toHaveBeenCalled();
    });

    it('should throw error when podcast episode not found', async () => {
        getPodcastEpisodeInfoMock.mockResolvedValue(null);

        expect(addEpisodeToListenLater(mockRequest))
            .rejects.toThrow('Podcast Episode not found');
    });

    it('should throw error when episode already added', async () => {
        getPodcastEpisodeInfoMock.mockResolvedValue({
            episode: mockFeedItem,
            podcast: {} as any
        });

        generateFeedItemIdMock.mockResolvedValue('generated-feed-item-id');
        generateFeedItemIdMock.mockResolvedValueOnce('generated-channel-id');

        // Mock that episode already exists
        prismaMock.user_listen_later.findFirst.mockResolvedValue({
            id: 'existing-id',
            user_id: 'user123',
            channel_id: 'generated-channel-id',
            item_id: 'generated-feed-item-id',
        } as any);

        await expect(addEpisodeToListenLater(mockRequest))
            .rejects.toThrow('Already added');
    });

    it('should throw error when database creation fails', async () => {
        getPodcastEpisodeInfoMock.mockResolvedValue({
            episode: mockFeedItem,
            podcast: {} as any
        });

        generateFeedItemIdMock.mockResolvedValue('generated-feed-item-id');
        generateFeedItemIdMock.mockResolvedValueOnce('generated-channel-id');

        prismaMock.user_listen_later.findFirst.mockResolvedValue(null);
        generateIDMock.mockResolvedValue('generated-id');

        // Mock database error
        prismaMock.user_listen_later.create.mockRejectedValue(new Error('Database error'));

        await expect(addEpisodeToListenLater(mockRequest))
            .rejects.toThrow('Something went wrong');
    });
});

describe('getUserListenLaterList()', () => {
    beforeEach(() => {
        queryUserListenLaterListMock.mockReset();
        queryUserListenLaterTotalCountMock.mockReset();
        formatDateTimeMock.mockReset();
    });

    const mockListenLaterItem: UserListenLaterDto = {
        id: 'item1',
        guid: 'guid1',
        channel_id: 'channel1',
        feed_id: 'feed1',
        title: 'Test Episode',
        highlightTitle: 'Test Episode',
        link: 'https://example.com/episode',
        pub_date: '2024-01-01T00:00:00Z',
        author: 'Test Author',
        input_date: '2024-01-01T00:00:00Z',
        image_url: 'https://example.com/image.jpg',
        enclosure_url: 'https://example.com/audio.mp3',
        enclosure_type: 'audio/mpeg',
        enclosure_length: '3600000',
        duration: '01:00:00',
        episode: '1',
        explicit: 'false',
        season: '1',
        episodeType: 'full',
        description: 'Test description',
        text_description: 'Test description',
        channel_image_url: 'https://example.com/channel.jpg',
        channel_title: 'Test Channel',
        highlightChannelTitle: 'Test Channel',
        feed_link: 'https://example.com/feed.rss',
        count: 1,
        tookTime: 0,
        hasThumbnail: false,
        source: 'itunes',
        country: 'US',
        reg_date: '2024-01-01T00:00:00Z',
    };

    it('should return user listen later list with formatted dates', async () => {
        queryUserListenLaterListMock.mockResolvedValue([mockListenLaterItem]);
        queryUserListenLaterTotalCountMock.mockResolvedValue(5);
        formatDateTimeMock.mockReturnValue('2024-01-01');

        const result = await getUserListenLaterList('user123', 10, 0);

        expect(result).toHaveLength(1);
        expect(result[0].count).toBe(5);
        expect(result[0].pub_date).toBe('2024-01-01');
        expect(result[0].input_date).toBe('2024-01-01');
        expect(result[0].reg_date).toBe('2024-01-01');
        expect(formatDateTimeMock).toHaveBeenCalledTimes(3);
    });

    it('should throw error when database query fails', async () => {
        queryUserListenLaterListMock.mockRejectedValue(new Error('Database error'));

        await expect(getUserListenLaterList('user123', 10, 0))
            .rejects.toThrow('Something went wrong');
    });

    it('should return empty list when no items found', async () => {
        queryUserListenLaterListMock.mockResolvedValue([]);
        queryUserListenLaterTotalCountMock.mockResolvedValue(0);

        const result = await getUserListenLaterList('user123', 10, 0);

        expect(result).toEqual([]);
    });

    it('should handle multiple items with proper count', async () => {
        const multipleItems = [mockListenLaterItem, { ...mockListenLaterItem, id: 'item2' }];
        queryUserListenLaterListMock.mockResolvedValue(multipleItems);
        queryUserListenLaterTotalCountMock.mockResolvedValue(10);
        formatDateTimeMock.mockReturnValue('2024-01-01');

        const result = await getUserListenLaterList('user123', 10, 0);

        expect(result).toHaveLength(2);
        expect(result[0].count).toBe(10);
        expect(result[1].count).toBe(10);
    });
});
