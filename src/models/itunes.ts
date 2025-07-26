
export type iTunesResponse = {
    results: Array<{
        collectionId: string;
        releaseDate: string;
        trackName: string;
        trackViewUrl: string;
        artistIds: number[];
        artworkUrl160: string;
        episodeUrl: string;
        episodeFileExtension: string;
        trackTimeMillis: number;
        description: string;
        artworkUrl600: string;
        collectionName: string;
        feedUrl: string;
        episodeGuid: string;
    }>;
}