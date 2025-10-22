/**
 * Podcast source types supported by the application
 */
export const PODCAST_SOURCES = {
    ITUNES: 'itunes',
    SPOTIFY: 'spotify'
} as const;

/**
 * Type representing valid podcast source values
 */
export type PodcastSource = typeof PODCAST_SOURCES[keyof typeof PODCAST_SOURCES];

/**
 * Get podcast source type from string value
 * @param sourceString The source string to validate ('itunes', 'spotify', etc.)
 * @returns PodcastSource if valid, null if invalid
 */
export function getPodcastSource(sourceString: string): PodcastSource | null {
    if (!sourceString || typeof sourceString !== 'string') {
        return null;
    }

    const normalized = sourceString.toLowerCase().trim();

    switch (normalized) {
        case PODCAST_SOURCES.ITUNES:
            return PODCAST_SOURCES.ITUNES;
        case PODCAST_SOURCES.SPOTIFY:
            return PODCAST_SOURCES.SPOTIFY;
        default:
            return null;
    }
}

/**
 * Check if a string value is a valid podcast source
 * @param sourceString The source string to validate
 * @returns true if valid, false if invalid
 */
export function isValidPodcastSource(sourceString: string): boolean {
    return getPodcastSource(sourceString) !== null;
}

/**
 * Get display name for a podcast source
 * @param source The podcast source
 * @returns Human-readable display name
 */
export function getPodcastSourceDisplayName(source: PodcastSource): string {
    switch (source) {
        case PODCAST_SOURCES.ITUNES:
            return 'iTunes';
        case PODCAST_SOURCES.SPOTIFY:
            return 'Spotify';
        default:
            return 'Unknown';
    }
}

/**
 * Array of all valid podcast source values
 */
export const VALID_PODCAST_SOURCES: readonly PodcastSource[] = [
    PODCAST_SOURCES.ITUNES,
    PODCAST_SOURCES.SPOTIFY
] as const;


export const DEFAULT_PODCAST_SOURCE = PODCAST_SOURCES.ITUNES