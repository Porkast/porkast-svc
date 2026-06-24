export interface PodcastIndexFeed {
  id: number
  podcastGuid: string
  title: string
  url: string
  originalUrl: string
  link: string
  description: string
  author: string
  ownerName: string
  image: string
  artwork: string
  lastUpdateTime: number
  lastCrawlTime: number
  lastParseTime: number
  lastGoodHttpStatusTime: number
  lastHttpStatus: number
  contentType: string
  itunesId: number | null
  generator: string
  language: string
  explicit: boolean
  type: number
  medium: string
  dead: number
  episodeCount: number
  crawlErrors: number
  parseErrors: number
  categories: Record<string, string>
  locked: number
  imageUrlHash: number
  newestItemPubdate: number
}

export interface PodcastIndexEpisode {
  id: number
  title: string
  link: string
  description: string
  guid: string
  datePublished: number
  datePublishedPretty: string
  dateCrawled: number
  enclosureUrl: string
  enclosureType: string
  enclosureLength: number
  duration: number
  explicit: number
  episode: number | null
  episodeType: string
  season: number | null
  image: string | null
  feedItunesId: number | null
  feedUrl: string
  feedImage: string
  feedId: number
  podcastGuid: string
  feedLanguage: string
  feedDead: number
  feedDuplicateOf: string | null
  chaptersUrl: string | null
  transcriptUrl: string | null
}

export interface PodcastIndexSearchResponse {
  status: boolean
  feeds: PodcastIndexFeed[]
  count: number
  query: string
  description: string
}

export interface PodcastIndexEpisodesResponse {
  status: boolean
  items: PodcastIndexEpisode[]
  count: number
  query: string
  description: string
}
