import { describe, expect, it } from 'vitest';
import { buildPodcastEpisodeUrl, encodeEpisodeId } from './episode_url';

describe('episode_url', () => {
    it('double-encodes URL GUIDs without leaving %2F in the path', () => {
        const guid = 'https://www.gcores.com/originals/222501';
        const encoded = encodeEpisodeId(guid);
        expect(encoded).toBe('https%253A%252F%252Fwww.gcores.com%252Foriginals%252F222501');
        expect(encoded.toLowerCase()).not.toContain('%2f');

        const url = buildPodcastEpisodeUrl(
            'https://porkast-tele-mini-app.guoshaotech.workers.dev',
            '420660752',
            guid
        );
        expect(url).toBe(
            'https://porkast-tele-mini-app.guoshaotech.workers.dev/podcast/420660752/episode/https%253A%252F%252Fwww.gcores.com%252Foriginals%252F222501'
        );
    });

    it('keeps plain UUID GUIDs unchanged', () => {
        expect(encodeEpisodeId('abc-123-def')).toBe('abc-123-def');
        expect(
            buildPodcastEpisodeUrl('https://porkast-tele-mini-app.guoshaotech.workers.dev', '420660752', 'abc-123-def')
        ).toBe('https://porkast-tele-mini-app.guoshaotech.workers.dev/podcast/420660752/episode/abc-123-def');
    });

    it('double-encodes query strings and hashes in URL GUIDs', () => {
        const guid = 'https://example.com/ep?a=1&b=foo%20bar#top';
        const url = buildPodcastEpisodeUrl(
            'https://porkast-tele-mini-app.guoshaotech.workers.dev',
            '420660752',
            guid
        );
        expect(url).toBe(
            'https://porkast-tele-mini-app.guoshaotech.workers.dev/podcast/420660752/episode/https%253A%252F%252Fexample.com%252Fep%253Fa%253D1%2526b%253Dfoo%252520bar%2523top'
        );
        expect(url.toLowerCase()).not.toContain('%2f');
    });

    it('strips trailing slashes from baseUrl', () => {
        expect(
            buildPodcastEpisodeUrl('https://porkast-tele-mini-app.guoshaotech.workers.dev///', '420660752', 'ep-1')
        ).toBe('https://porkast-tele-mini-app.guoshaotech.workers.dev/podcast/420660752/episode/ep-1');
    });

    it('handles empty, null, and undefined itemIds safely', () => {
        expect(encodeEpisodeId('')).toBe('');
        expect(encodeEpisodeId(null)).toBe('');
        expect(encodeEpisodeId(undefined)).toBe('');
    });
});
