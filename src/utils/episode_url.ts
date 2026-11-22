/**
 * Double-encodes an episode GUID for URL path segments so `%2F` becomes `%252F`
 * and is not collapsed into `/` by Cloudflare Workers Static Assets normalization.
 */
export function encodeEpisodeId(itemId: string | number | null | undefined): string {
    if (itemId === null || itemId === undefined) return '';
    const str = String(itemId);
    if (!str) return '';
    return encodeURIComponent(encodeURIComponent(str));
}

/**
 * Builds an episode detail URL for the Mini App / Web frontend with a safely
 * double-encoded episode GUID.
 */
export function buildPodcastEpisodeUrl(
    baseUrl: string,
    channelId: string | number | null | undefined,
    itemId: string | number | null | undefined
): string {
    const normalizedBase = baseUrl.replace(/\/+$/, '');
    return `${normalizedBase}/podcast/${encodeURIComponent(String(channelId ?? ''))}/episode/${encodeEpisodeId(itemId)}`;
}
