import { FeedItem } from '../models/feeds'
import { PodcastIndexFeed, PodcastIndexEpisode, PodcastIndexSearchResponse, PodcastIndexEpisodesResponse } from '../models/podcast-index'
import { logger } from './logger'

let podcastIndexApiKeyOverride: string | null = null
let podcastIndexApiSecretOverride: string | null = null

export function setPodcastIndexCredentials(apiKey: string, apiSecret: string) {
  podcastIndexApiKeyOverride = apiKey
  podcastIndexApiSecretOverride = apiSecret
}

export class PodcastIndexAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PodcastIndexAuthError'
  }
}

export class PodcastIndexSearchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PodcastIndexSearchError'
  }
}

const API_BASE = 'https://api.podcastindex.org/api/1.0'
const MAX_SEARCH_FEEDS = 5
const MAX_EPISODES_PER_FEED = 50

async function generateAuthHeaders(apiKey: string, apiSecret: string): Promise<Headers> {
  const apiHeaderTime = Math.floor(Date.now() / 1000)
  const data = new TextEncoder().encode(apiKey + apiSecret + apiHeaderTime)
  const hash = await crypto.subtle.digest('SHA-1', data)
  const hashHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return new Headers({
    'User-Agent': 'Porkast/1.0',
    'X-Auth-Key': apiKey,
    'X-Auth-Date': String(apiHeaderTime),
    'Authorization': hashHex,
  })
}

async function searchPodcasts(apiKey: string, apiSecret: string, keyword: string, max: number = MAX_SEARCH_FEEDS): Promise<PodcastIndexFeed[]> {
  const headers = await generateAuthHeaders(apiKey, apiSecret)
  const url = `${API_BASE}/search/byterm?q=${encodeURIComponent(keyword)}&max=${max}`

  const res = await fetch(url, { headers, method: 'GET' })

  if (!res.ok) {
    throw new PodcastIndexSearchError(`Podcast Index search failed: ${res.status} ${res.statusText}`)
  }

  const data: PodcastIndexSearchResponse = await res.json()
  if (!data.status || !data.feeds) {
    return []
  }

  return data.feeds
}

async function getEpisodesByFeedUrl(apiKey: string, apiSecret: string, feedUrl: string, max: number = MAX_EPISODES_PER_FEED, since?: number): Promise<PodcastIndexEpisode[]> {
  const headers = await generateAuthHeaders(apiKey, apiSecret)
  let url = `${API_BASE}/episodes/byfeedurl?url=${encodeURIComponent(feedUrl)}&max=${max}`
  if (since) {
    url += `&since=${since}`
  }

  const res = await fetch(url, { headers, method: 'GET' })

  if (!res.ok) {
    logger.warn(`Podcast Index episodes fetch failed for ${feedUrl}: ${res.status} ${res.statusText}`)
    return []
  }

  const data: PodcastIndexEpisodesResponse = await res.json()
  if (!data.status || !data.items) {
    return []
  }

  return data.items
}

function convertDuration(duration: number): string {
  if (!duration || duration <= 0) return ''

  const hours = Math.floor(duration / 3600)
  const minutes = Math.floor((duration % 3600) / 60)
  const seconds = Math.floor(duration % 60)

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function convertPubDate(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
}

async function buildEpisodeFeedItem(
  episode: PodcastIndexEpisode,
  feed: PodcastIndexFeed,
  country: string,
): Promise<FeedItem> {
  return {
    Id: episode.guid || String(episode.id),
    GUID: episode.guid || String(episode.id),
    ChannelId: feed.itunesId ? String(feed.itunesId) : String(feed.id),
    Title: episode.title,
    HighlightTitle: episode.title,
    Link: episode.link || feed.link,
    PubDate: convertPubDate(episode.datePublished),
    Author: feed.author,
    InputDate: new Date(episode.datePublished * 1000),
    ImageUrl: episode.feedImage || episode.image || feed.image || feed.artwork,
    EnclosureUrl: episode.enclosureUrl,
    EnclosureType: episode.enclosureType || 'audio/mpeg',
    EnclosureLength: String(episode.enclosureLength || ''),
    Duration: convertDuration(episode.duration),
    Episode: episode.episode ? String(episode.episode) : '',
    Explicit: episode.explicit ? 'yes' : 'no',
    Season: episode.season ? String(episode.season) : '',
    EpisodeType: episode.episodeType || '',
    Description: episode.description || '',
    TextDescription: episode.description || '',
    ChannelImageUrl: feed.image || feed.artwork,
    ChannelTitle: feed.title,
    HighlightChannelTitle: feed.title,
    FeedLink: feed.url,
    Count: 0,
    TookTime: 0,
    HasThumbnail: !!(feed.image || feed.artwork || episode.feedImage || episode.image),
    FeedId: String(feed.id),
    Source: 'podcast_index',
    ExcludeFeedId: '',
    Country: country,
  }
}

export async function searchEpisodesFromPodcastIndex(
  keyword: string,
  country: string,
  excludeFeedId: string,
  offset: number,
  limit: number,
  totalCount: number,
): Promise<FeedItem[]> {
  const apiKey = podcastIndexApiKeyOverride || process.env.PODCAST_INDEX_API_KEY || ''
  const apiSecret = podcastIndexApiSecretOverride || process.env.PODCAST_INDEX_API_SECRET || ''

  if (!apiKey || !apiSecret) {
    throw new PodcastIndexAuthError('Podcast Index API credentials not set. Set PODCAST_INDEX_API_KEY and PODCAST_INDEX_API_SECRET.')
  }

  logger.debug(`Podcast Index search: "${keyword}" (country: ${country})`)

  const feeds = await searchPodcasts(apiKey, apiSecret, keyword, MAX_SEARCH_FEEDS)

  if (feeds.length === 0) {
    logger.debug(`No feeds found for keyword: "${keyword}"`)
    return []
  }

  const excludeFeedIdList = excludeFeedId ? excludeFeedId.split(',') : []

  const feedEpisodesResults = await Promise.allSettled(
    feeds.map(feed => getEpisodesByFeedUrl(apiKey, apiSecret, feed.url, MAX_EPISODES_PER_FEED))
  )

  const allFeedItems: FeedItem[] = []

  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i]
    const result = feedEpisodesResults[i]

    if (result.status === 'rejected') {
      logger.warn(`Failed to fetch episodes for feed "${feed.title}": ${result.reason}`)
      continue
    }

    if (excludeFeedIdList.includes(String(feed.itunesId || feed.id))) {
      continue
    }

    const episodes = result.value
    for (const episode of episodes) {
      const item = await buildEpisodeFeedItem(episode, feed, country)
      allFeedItems.push(item)
    }
  }

  allFeedItems.sort((a, b) => {
    return new Date(b.PubDate).getTime() - new Date(a.PubDate).getTime()
  })

  allFeedItems.forEach((item, _index, arr) => {
    item.Count = arr.length
  })

  if (limit === 0) {
    return allFeedItems
  }

  return allFeedItems.slice(offset, offset + limit)
}
