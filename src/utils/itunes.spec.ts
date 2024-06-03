import { searchPodcastEpisodeFromItunes } from "./itunes"


describe('searchPodcastEpisodeFromItunes', () => {
    it('should return a list of podcast episodes', async () => {
        const result = await searchPodcastEpisodeFromItunes('The Verge', 'podcastEpisode', 'US', '1234', 0, 10, 50)
        expect(result.length).toBeGreaterThan(0)
    })
})