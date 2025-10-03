import { logger } from './logger';
import { FeedItem, FeedChannel } from '../models/feeds';

interface SpotifyTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

interface TokenCache {
    token: string;
    expiresAt: number; // Unix timestamp in milliseconds
}

// Module-level cache for access token
let tokenCache: TokenCache | null = null;
let isFetchingToken = false; // Prevent concurrent token requests

interface SpotifyImage {
    height: number;
    url: string;
    width: number;
}

interface SpotifyShow {
    id: string;
    name: string;
    description: string;
    html_description: string;
    publisher: string;
    images: SpotifyImage[];
    external_urls: { spotify: string };
    total_episodes: number;
    available_markets: string[];
    copyrights: Array<{ text: string; type: string }>;
    languages: string[];
    explicit: boolean;
    type: string;
    uri: string;
}

interface SpotifyEpisode {
    id: string;
    name: string;
    description: string;
    html_description: string;
    duration_ms: number;
    explicit: boolean;
    release_date: string;
    release_date_precision: string;
    language: string;
    languages: string[];
    images: SpotifyImage[];
    external_urls: { spotify: string };
    audio_preview_url: string;
    is_playable: boolean;
    is_externally_hosted: boolean;
    type: string;
    uri: string;
}

interface SpotifyEpisodeDetail extends SpotifyEpisode {
    show: SpotifyShow;
    resume_point?: {
        fully_played: boolean;
        resume_position_ms: number;
    };
    restrictions?: {
        reason: string;
    };
}

interface SpotifyShowDetail extends SpotifyShow {
    episodes: {
        href: string;
        limit: number;
        next: string | null;
        offset: number;
        previous: string | null;
        total: number;
        items: SpotifyEpisode[];
    };
}

interface SpotifySearchResponse {
    episodes: {
        href: string;
        limit: number;
        next: string | null;
        offset: number;
        previous: string | null;
        total: number;
        items: SpotifyEpisode[];
    };
}

export class SpotifyAuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SpotifyAuthError';
    }
}

export class SpotifySearchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SpotifySearchError';
    }
}

export class SpotifyEpisodeDetailError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SpotifyEpisodeDetailError';
    }
}

export class SpotifyShowDetailError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SpotifyShowDetailError';
    }
}

/**
 * Get Spotify access token using client credentials flow with caching
 * @param clientId Spotify application client ID (optional, uses env var if not provided)
 * @param clientSecret Spotify application client secret (optional, uses env var if not provided)
 * @returns Promise<string> Access token
 */
export async function getSpotifyAccessToken(clientId?: string, clientSecret?: string): Promise<string> {
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer before expiration

    // Check if we have a valid cached token
    if (tokenCache && tokenCache.expiresAt > (now + bufferTime)) {
        logger.debug('Using cached Spotify access token');
        return tokenCache.token;
    }

    // If another request is already fetching a token, wait for it
    if (isFetchingToken) {
        logger.debug('Token fetch in progress, waiting...');
        while (isFetchingToken) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
        }
        // Check cache again after waiting
        if (tokenCache && tokenCache.expiresAt > (now + bufferTime)) {
            logger.debug('Using cached Spotify access token after wait');
            return tokenCache.token;
        }
    }

    // Set fetching flag to prevent concurrent requests
    isFetchingToken = true;

    try {
        const spotifyClientId = clientId || process.env.SPOTIFY_CLIENT_ID;
        const spotifyClientSecret = clientSecret || process.env.SPOTIFY_CLIENT_SECRET;

        if (!spotifyClientId || !spotifyClientSecret) {
            throw new SpotifyAuthError('Spotify client ID and secret are required. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.');
        }

        logger.debug('Fetching new Spotify access token from API');

        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: spotifyClientId,
                client_secret: spotifyClientSecret,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`Spotify token request failed: ${response.status} ${response.statusText}`, errorText);
            throw new SpotifyAuthError(`Failed to get Spotify access token: ${response.status} ${response.statusText}`);
        }

        const data: SpotifyTokenResponse = await response.json();

        if (!data.access_token) {
            logger.error('Spotify token response missing access_token', data);
            throw new SpotifyAuthError('Invalid response from Spotify: missing access_token');
        }

        // Cache the token with expiration time
        const expiresAt = now + (data.expires_in * 1000); // Convert seconds to milliseconds
        tokenCache = {
            token: data.access_token,
            expiresAt: expiresAt
        };

        logger.debug(`Successfully cached new Spotify access token, expires at ${new Date(expiresAt).toISOString()}`);
        return data.access_token;

    } catch (error) {
        // Clear cache on error
        tokenCache = null;

        if (error instanceof SpotifyAuthError) {
            throw error;
        }

        logger.error('Unexpected error getting Spotify access token:', error);
        throw new SpotifyAuthError(`Failed to get Spotify access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        // Always reset the fetching flag
        isFetchingToken = false;
    }
}

/**
 * Search for podcast episodes on Spotify
 * @param query Search query (will be URL encoded)
 * @param market Market code (default: 'US')
 * @param limit Maximum number of results (default: 50, max: 50)
 * @param offset Offset for pagination (default: 0)
 * @returns Promise<FeedItem[]> Array of podcast episodes in FeedItem format
 */
export async function searchSpotifyEpisodes(query: string, market: string = 'US', limit: number = 50, offset: number = 0): Promise<FeedItem[]> {
    try {
        logger.debug(`Searching Spotify episodes: "${query}" (market: ${market}, limit: ${limit}, offset: ${offset})`);

        // Get access token
        const accessToken = await getSpotifyAccessToken();

        // Build search URL
        const searchParams = new URLSearchParams({
            q: query,
            type: 'episode',
            market: market,
            limit: Math.min(limit, 50).toString(), // Spotify max is 50
            offset: offset.toString(),
        });

        const searchUrl = `https://api.spotify.com/v1/search?${searchParams.toString()}`;

        // Make search request
        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`Spotify search request failed: ${response.status} ${response.statusText}`, errorText);
            throw new SpotifySearchError(`Failed to search Spotify episodes: ${response.status} ${response.statusText}`);
        }

        const data: SpotifySearchResponse = await response.json();

        if (!data.episodes || !data.episodes.items) {
            logger.error('Spotify search response missing episodes data', data);
            throw new SpotifySearchError('Invalid response from Spotify: missing episodes data');
        }

        // Convert Spotify episodes to FeedItem format
        const feedItems: FeedItem[] = []
        for (let index = 0; index < data.episodes.items.length; index++) {
            const episode = data.episodes.items[index];
            if (!episode) {
                continue
            }
             // Get the best quality image (largest)
            const imageUrl = episode.images.length > 0
                ? episode.images.sort((a, b) => b.width - a.width)[0].url
                : '';

            // Convert duration from milliseconds to HH:MM:SS format
            const durationMs = episode.duration_ms;
            const hours = Math.floor(durationMs / 3600000);
            const minutes = Math.floor((durationMs % 3600000) / 60000);
            const seconds = Math.floor((durationMs % 60000) / 1000);
            const duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            const feedItem: FeedItem = {
                Id: episode.id,
                ChannelId: '', // Spotify doesn't provide channel ID in search results
                Title: episode.name,
                HighlightTitle: episode.name,
                Link: episode.external_urls.spotify,
                PubDate: episode.release_date,
                Author: '', // Spotify doesn't provide author in search results
                InputDate: new Date(episode.release_date),
                ImageUrl: imageUrl,
                EnclosureUrl: episode.audio_preview_url || '', // Preview URL if available
                EnclosureType: 'audio/mpeg', // Assume MP3 for Spotify
                EnclosureLength: durationMs.toString(),
                Duration: duration,
                Episode: '',
                Explicit: episode.explicit ? 'yes' : 'no',
                Season: '',
                EpisodeType: '',
                Description: episode.html_description,
                TextDescription: episode.description,
                ChannelImageUrl: imageUrl,
                ChannelTitle: '', // Spotify doesn't provide channel title in search results
                HighlightChannelTitle: '',
                FeedLink: '',
                Count: data.episodes.total,
                TookTime: 0,
                HasThumbnail: episode.images.length > 0,
                FeedId: '', // Will be set when we have more context
                GUID: episode.id,
                Source: 'spotify',
                ExcludeFeedId: '',
                Country: market,
            };

            feedItems.push(feedItem);
        }

        logger.debug(`Successfully found ${feedItems.length} Spotify episodes for query "${query}"`);
        return feedItems;

    } catch (error) {
        if (error instanceof SpotifyAuthError || error instanceof SpotifySearchError) {
            throw error;
        }

        logger.error('Unexpected error searching Spotify episodes:', error);
        throw new SpotifySearchError(`Failed to search Spotify episodes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get detailed information for a specific Spotify episode by ID
 * @param episodeId Spotify episode ID
 * @param market Market code (optional, default: 'US')
 * @returns Promise<FeedItem> Detailed episode information in FeedItem format
 */
export async function getSpotifyEpisodeDetail(episodeId: string, market: string = 'US'): Promise<FeedItem> {
    try {
        logger.debug(`Getting Spotify episode detail for ID: ${episodeId} (market: ${market})`);

        // Get access token
        const accessToken = await getSpotifyAccessToken();

        // Build episode detail URL
        const detailUrl = `https://api.spotify.com/v1/episodes/${episodeId}?market=${market}`;

        // Make detail request
        const response = await fetch(detailUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`Spotify episode detail request failed: ${response.status} ${response.statusText}`, errorText);
            throw new SpotifyEpisodeDetailError(`Failed to get Spotify episode detail: ${response.status} ${response.statusText}`);
        }

        const episodeDetail: SpotifyEpisodeDetail = await response.json();

        // Validate response
        if (!episodeDetail.id || !episodeDetail.show) {
            logger.error('Spotify episode detail response missing required data', episodeDetail);
            throw new SpotifyEpisodeDetailError('Invalid response from Spotify: missing episode or show data');
        }

        // Get the best quality episode image
        const episodeImageUrl = episodeDetail.images.length > 0
            ? episodeDetail.images.sort((a, b) => b.width - a.width)[0].url
            : '';

        // Get the best quality show/podcast image
        const showImageUrl = episodeDetail.show.images.length > 0
            ? episodeDetail.show.images.sort((a, b) => b.width - a.width)[0].url
            : '';

        // Convert duration from milliseconds to HH:MM:SS format
        const durationMs = episodeDetail.duration_ms;
        const hours = Math.floor(durationMs / 3600000);
        const minutes = Math.floor((durationMs % 3600000) / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        const duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Create FeedItem with detailed information
        const feedItem: FeedItem = {
            Id: episodeDetail.id,
            ChannelId: episodeDetail.show.id,
            Title: episodeDetail.name,
            HighlightTitle: episodeDetail.name,
            Link: episodeDetail.external_urls.spotify,
            PubDate: episodeDetail.release_date,
            Author: episodeDetail.show.publisher,
            InputDate: new Date(episodeDetail.release_date),
            ImageUrl: episodeImageUrl,
            EnclosureUrl: episodeDetail.audio_preview_url || '', // Preview URL if available
            EnclosureType: 'audio/mpeg', // Assume MP3 for Spotify
            EnclosureLength: durationMs.toString(),
            Duration: duration,
            Episode: '',
            Explicit: episodeDetail.explicit ? 'yes' : 'no',
            Season: '',
            EpisodeType: '',
            Description: episodeDetail.html_description,
            TextDescription: episodeDetail.description,
            ChannelImageUrl: showImageUrl,
            ChannelTitle: episodeDetail.show.name,
            HighlightChannelTitle: episodeDetail.show.name,
            FeedLink: episodeDetail.show.external_urls.spotify,
            Count: episodeDetail.show.total_episodes,
            TookTime: 0,
            HasThumbnail: episodeDetail.images.length > 0,
            FeedId: episodeDetail.show.id,
            GUID: episodeDetail.id,
            Source: 'spotify',
            ExcludeFeedId: '',
            Country: market,
        };

        logger.debug(`Successfully retrieved detailed information for Spotify episode: ${episodeDetail.name}`);
        return feedItem;

    } catch (error) {
        if (error instanceof SpotifyAuthError || error instanceof SpotifyEpisodeDetailError) {
            throw error;
        }

        logger.error('Unexpected error getting Spotify episode detail:', error);
        throw new SpotifyEpisodeDetailError(`Failed to get Spotify episode detail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get detailed information for a specific Spotify show (podcast) by ID
 * @param showId Spotify show ID
 * @param market Market code (optional, default: 'US')
 * @returns Promise<FeedChannel> Detailed show information in FeedChannel format
 */
export async function getSpotifyShowDetail(showId: string, market: string = 'US'): Promise<FeedChannel> {
    try {
        logger.debug(`Getting Spotify show detail for ID: ${showId} (market: ${market})`);

        // Get access token
        const accessToken = await getSpotifyAccessToken();

        // Build show detail URL
        const detailUrl = `https://api.spotify.com/v1/shows/${showId}?market=${market}`;

        // Make detail request
        const response = await fetch(detailUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`Spotify show detail request failed: ${response.status} ${response.statusText}`, errorText);
            throw new SpotifyShowDetailError(`Failed to get Spotify show detail: ${response.status} ${response.statusText}`);
        }

        const showDetail: SpotifyShowDetail = await response.json();

        // Validate response
        if (!showDetail.id || !showDetail.name) {
            logger.error('Spotify show detail response missing required data', showDetail);
            throw new SpotifyShowDetailError('Invalid response from Spotify: missing show data');
        }

        // Get the best quality show image
        const showImageUrl = showDetail.images.length > 0
            ? showDetail.images.sort((a, b) => b.width - a.width)[0].url
            : '';

        // Get copyright text
        const copyrightText = showDetail.copyrights.length > 0
            ? showDetail.copyrights[0].text
            : '';

        // Get primary language
        const primaryLanguage = showDetail.languages.length > 0
            ? showDetail.languages[0]
            : '';

        // Convert episodes to FeedItem array
        const feedItems: FeedItem[] = []
        for (let index = 0; index < showDetail.episodes.items.length; index++) {
            const episode = showDetail.episodes.items[index];
            // Get the best quality episode image
            if (episode === null || episode === undefined) {
                continue
            }
            const episodeImageUrl = episode.images && episode.images.length > 0
                ? episode.images.sort((a, b) => b.width - a.width)[0].url
                : showImageUrl; // Fallback to show image

            // Convert duration from milliseconds to HH:MM:SS format
            const durationMs = episode.duration_ms;
            const hours = Math.floor(durationMs / 3600000);
            const minutes = Math.floor((durationMs % 3600000) / 60000);
            const seconds = Math.floor((durationMs % 60000) / 1000);
            const duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            const feedItem = {
                Id: episode.id,
                ChannelId: showDetail.id,
                Title: episode.name,
                HighlightTitle: episode.name,
                Link: episode.external_urls.spotify,
                PubDate: episode.release_date,
                Author: showDetail.publisher,
                InputDate: new Date(episode.release_date),
                ImageUrl: episodeImageUrl,
                EnclosureUrl: episode.audio_preview_url || '', // Preview URL if available
                EnclosureType: 'audio/mpeg', // Assume MP3 for Spotify
                EnclosureLength: durationMs.toString(),
                Duration: duration,
                Episode: '',
                Explicit: episode.explicit ? 'yes' : 'no',
                Season: '',
                EpisodeType: '',
                Description: episode.html_description,
                TextDescription: episode.description,
                ChannelImageUrl: showImageUrl,
                ChannelTitle: showDetail.name,
                HighlightChannelTitle: showDetail.name,
                FeedLink: showDetail.external_urls.spotify,
                Count: showDetail.total_episodes,
                TookTime: 0,
                HasThumbnail: episode.images.length > 0,
                FeedId: showDetail.id,
                GUID: episode.id,
                Source: 'spotify',
                ExcludeFeedId: '',
                Country: market,
            };
            feedItems.push(feedItem);
        }

        // Create FeedChannel from Spotify show data
        const feedChannel: FeedChannel = {
            Id: showDetail.id,
            Title: showDetail.name,
            ChannelDesc: showDetail.html_description,
            TextChannelDesc: showDetail.description,
            ImageUrl: showImageUrl,
            Link: showDetail.external_urls.spotify,
            FeedLink: showDetail.external_urls.spotify,
            FeedType: 'spotify',
            Categories: [], // Spotify doesn't provide categories in show detail
            Author: showDetail.publisher,
            OwnerName: showDetail.publisher, // Use publisher as owner name
            OwnerEmail: '', // Spotify doesn't provide email
            Items: feedItems, // Converted episodes
            Count: showDetail.total_episodes,
            Copyright: copyrightText,
            Language: primaryLanguage,
            TookTime: 0,
            HasThumbnail: showDetail.images.length > 0,
        };

        logger.debug(`Successfully retrieved and converted Spotify show: ${showDetail.name} (${feedItems.length} episodes)`);
        return feedChannel;

    } catch (error) {
        if (error instanceof SpotifyAuthError || error instanceof SpotifyShowDetailError) {
            throw error;
        }

        logger.error('Unexpected error getting Spotify show detail:', error);
        throw new SpotifyShowDetailError(`Failed to get Spotify show detail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
