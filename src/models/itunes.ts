import { Feed, Item } from "podcast";

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

export interface PodcastFeed extends Feed {
    itunes: {
        title: string
        author: string
        summary: string
        owner: {
            name: string
            email: string
        }
        image: string
        type: string
        categories: string[]
    }
    items: PodcastItem
}

export interface PodcastItem extends Item {
    itunes: {
        duration: string
        image: string
        author: string
        title: string
        episode: string
        season: string
        summary: string
    }
}

