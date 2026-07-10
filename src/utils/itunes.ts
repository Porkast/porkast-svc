import { FeedChannel, FeedItem } from "../models/feeds"
import { convertMillsTimeToDuration, generateFeedItemId } from "./common"
import { iTunesResponse, PodcastFeed, PodcastItem } from "../models/itunes"
import Parser from "rss-parser"
import { logger } from "./logger"
import { feedItem, keywordSubscription } from "../db/schema"
import type { Env } from "../env"

let itunesFetch: typeof globalThis.fetch = globalThis.fetch
let proxyBaseUrl: string = ''
let containerNs: any = null
let webshareProxyUrl: string = ''

export function initItunesProxy(env: Env): void {
  proxyBaseUrl = env.ITUNES_PROXY_BASE_URL || ''
  containerNs = env.ITUNES_PROXY
  webshareProxyUrl = env.WEBSHARE_PROXY_URL || ''

  if (proxyBaseUrl || containerNs) {
    itunesFetch = ((url: string | URL | Request, _init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url
      const targetUrl = new URL(urlStr)
      const path = targetUrl.pathname === '/search' ? '/search' : '/lookup'
      return handleItunesFetch(path, targetUrl.search)
    }) as unknown as typeof globalThis.fetch
  } else {
    itunesFetch = globalThis.fetch
  }
}

async function handleItunesFetch(path: string, search: string): Promise<Response> {
  if (proxyBaseUrl) {
    return fetch(`${proxyBaseUrl}${path}${search}`)
  }
  if (containerNs) {
    const container = containerNs.getByName("singleton")
    await container.startAndWaitForPorts({
      startOptions: { envVars: { WEBSHARE_PROXY_URL: webshareProxyUrl } }
    })
    return container.fetch(`http://container${path}${search}`)
  }
  throw new Error('No iTunes proxy configured')
}

export class ItunesRateLimitError extends Error {
  retryAfter: number
  constructor(retryAfter: number) {
    super('iTunes API rate limited')
    this.name = 'ItunesRateLimitError'
    this.retryAfter = retryAfter
  }
}

async function checkItunesResponse(res: Response): Promise<void> {
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10)
    throw new ItunesRateLimitError(retryAfter)
  }
  if (!res.ok) {
    throw new Error(`iTunes API error: ${res.status} ${res.statusText}`)
  }
}

export const searchPodcastEpisodeFromItunes = async (q: string, entity: string, country: string, excludeFeedId: string, offset: number, limit: number, totalCount: number): Promise<FeedItem[]> => {
    const searchUrl = `https://itunes.apple.com/search?term=${q}&entity=${entity}&media=podcast&country=${country}&limit=${totalCount}`
    const res = await itunesFetch(searchUrl)
    logger.debug(`search url: ${searchUrl}`)

    await checkItunesResponse(res)
    const jsonRespJson = await res.json();
    logger.debug(`search result: ${JSON.stringify(jsonRespJson)}`)
    const jsonResp = jsonRespJson as iTunesResponse
    var items: FeedItem[] = []
    let excludeFeedIdList: string[] = []
    if (excludeFeedId) {
        excludeFeedIdList = excludeFeedId.split(',')
    }
    for (const resultItem of jsonResp.results) {
        // if the resultItem.collectionId is in excludeFeedIdList, skip
        if (excludeFeedIdList.includes(String(resultItem.collectionId))) {
            continue
        }

        // format pubdate as yy:mm:dd
        const formatedPubDate = new Date(resultItem.releaseDate).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

        const duration = convertMillsTimeToDuration(resultItem.trackTimeMillis)
        items.push({
            Id: resultItem.episodeGuid,
            ChannelId: resultItem.collectionId,
            Title: resultItem.trackName,
            HighlightTitle: resultItem.trackName,
            Link: resultItem.trackViewUrl,
            PubDate: formatedPubDate,
            Author: resultItem.artistIds.map(id => String(id)).join(', '),
            InputDate: new Date(formatedPubDate),
            ImageUrl: resultItem.artworkUrl160,
            EnclosureUrl: resultItem.episodeUrl,
            EnclosureType: resultItem.episodeFileExtension,
            EnclosureLength: String(resultItem.trackTimeMillis),
            Duration: duration,
            Episode: "",
            Explicit: "",
            Season: "",
            EpisodeType: "",
            Description: resultItem.description,
            TextDescription: resultItem.description,
            ChannelImageUrl: resultItem.artworkUrl600,
            ChannelTitle: resultItem.collectionName,
            HighlightChannelTitle: resultItem.collectionName,
            FeedLink: resultItem.feedUrl,
            Count: 0,
            TookTime: 0,
            HasThumbnail: false,
            FeedId: resultItem.collectionId,
            GUID: resultItem.episodeGuid,
            Source: "itunes",
            ExcludeFeedId: "",
            Country: country
        })
    }

    items.map(item => {
        item.Count = items.length
    })

    // order by pubDate desc
    items.sort((a, b) => {
        return new Date(b.PubDate).getTime() - new Date(a.PubDate).getTime()
    })

    if (limit == 0) {
        return items
    }

    return items.slice(offset, offset + limit)
}

export const buildFeedItemAndKeywordInputList = async (keyword: string, country: string, excludeFeedIds: string, source: string, feedItemList: FeedItem[]): Promise<{ feedItemList: typeof feedItem.$inferInsert[], keywordSubscriptionList: typeof keywordSubscription.$inferInsert[] }> => {
    const feedItemCreateInputList: typeof feedItem.$inferInsert[] = []
    const keywordSubscriptionInputList: typeof keywordSubscription.$inferInsert[] = []


    for (const item of feedItemList) {
        const itemId = await generateFeedItemId(item.FeedLink, item.Title)
        const channelId = await generateFeedItemId(item.FeedLink, item.ChannelTitle)
        const feedItemInput: typeof feedItem.$inferInsert = {
            id: itemId,
            channelId: channelId,
            feedId: String(item.FeedId),
            guid: item.GUID,
            title: item.Title,
            link: item.Link,
            pubDate: item.PubDate,
            author: item.Author,
            inputDate: new Date().toISOString(),
            imageUrl: item.ImageUrl,
            enclosureUrl: item.EnclosureUrl,
            enclosureType: item.EnclosureType,
            enclosureLength: String(item.EnclosureLength),
            duration: item.Duration,
            episode: item.Episode,
            episodetype: item.EpisodeType,
            explicit: item.Explicit,
            season: item.Season,
            description: new TextEncoder().encode(item.Description || ''),
            channelTitle: item.ChannelTitle,
            feedLink: item.FeedLink,
            source: item.Source,
        }

        const keywordSubscriptionInput: typeof keywordSubscription.$inferInsert = {
            keyword: keyword,
            feedChannelId: channelId,
            feedItemId: itemId,
            createTime: new Date().toISOString(),
            country: country,
            source: source,
            excludeFeedId: excludeFeedIds,
        }

        feedItemCreateInputList.push(feedItemInput)
        keywordSubscriptionInputList.push(keywordSubscriptionInput)
    }
    return {
        feedItemList: feedItemCreateInputList,
        keywordSubscriptionList: keywordSubscriptionInputList
    }
}

export const getPodcastEpisodeInfo = async (podcastId: string, episodeId: string): Promise<{ podcast: FeedChannel, episode: FeedItem }> => {
    const res = await itunesFetch(`https://itunes.apple.com/lookup?id=${podcastId}&entity=podcast`)
    await checkItunesResponse(res)
    const jsonResp = await res.json() as { results?: Array<{ feedUrl?: string }> }
    const podcastInfo = jsonResp?.results?.[0]
    if (!podcastInfo?.feedUrl) {
        throw new Error('Podcast Episode not found')
    }
    const feedLink = podcastInfo.feedUrl
    const rss = await parsePodcastRSS(feedLink);
    const episodeInfo = buildFeedItemModel(rss, feedLink, episodeId, podcastId);
    var channelInfo: FeedChannel = buildFeedChannelModel(rss, feedLink, podcastId);

    return {
        podcast: channelInfo,
        episode: episodeInfo
    }
}

const parsePodcastRSS = async (feedUrl: string): Promise<PodcastFeed & Parser.Output<PodcastItem>> => {
    const parser: Parser<PodcastFeed, PodcastItem> = new Parser();
    const rssResp = await fetch(feedUrl);
    const rssStr = await rssResp.text();
    const feed = await parser.parseString(rssStr);
    return feed
}

const buildFeedItemModel = (rssFeed: PodcastFeed & Parser.Output<PodcastItem>, feedLink: string, episodeId: string, podcastId: string): FeedItem => {
    const rssChannelInfo = rssFeed;
    const rssItemList = rssFeed.items
    const targetItem = rssItemList.find(item => {
        if (encodeURIComponent(item.guid) === episodeId || item.guid === episodeId) {
            return true
        }
    })
    // fill episode info with rss data 
    const formatedPubDate = new Date(targetItem?.pubDate || '').toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    var formaedDuration = '';
    // if duration contain : then ignore it 
    const durationStr = String(targetItem?.itunes.duration)
    if (durationStr.includes(':')) {
        formaedDuration = durationStr
    } else {
        const durationInt = parseInt(durationStr || '0')
        formaedDuration = convertMillsTimeToDuration(durationInt)
    }
    var episodeInfo: FeedItem = {
        Id: episodeId,
        ChannelId: podcastId,
        Title: targetItem?.title || '',
        HighlightTitle: targetItem?.title || '',
        Link: targetItem?.link || '',
        PubDate: formatedPubDate,
        Author: rssChannelInfo.itunes?.author || targetItem?.itunesAuthor || rssChannelInfo.author || '',
        InputDate: new Date(targetItem?.pubDate || ''),
        ImageUrl: targetItem?.itunesImage || rssChannelInfo.itunes?.image || rssChannelInfo.imageUrl || '',
        EnclosureUrl: targetItem?.enclosure?.url || '',
        EnclosureType: targetItem?.enclosure?.type || '',
        EnclosureLength: String(targetItem?.enclosure?.length || ''),
        Duration: formaedDuration,
        Episode: String(targetItem?.itunesEpisode || ''),
        Explicit: String(targetItem?.itunesExplicit || false),
        Season: String(targetItem?.itunesSeason || ''),
        EpisodeType: String(targetItem?.itunesEpisodeType || ''),
        Description: targetItem?.description || targetItem?.content || "",
        TextDescription: targetItem?.description || targetItem?.contentSnippet || "",
        ChannelImageUrl: rssChannelInfo.itunesImage || rssChannelInfo.imageUrl || '',
        ChannelTitle: rssChannelInfo.title,
        HighlightChannelTitle: rssChannelInfo.title,
        FeedLink: feedLink,
        Count: 0,
        TookTime: 0,
        HasThumbnail: false,
        FeedId: podcastId,
        GUID: episodeId,
        Source: "itunes",
        ExcludeFeedId: "",
        Country: ""
    }

    return episodeInfo
}

const buildFeedChannelModel = (rssFeed: PodcastFeed & Parser.Output<PodcastItem>, feedLink: string, podcastId: string): FeedChannel => {
    const rssChannelInfo = rssFeed;
    var channelInfo: FeedChannel = {
        Id: podcastId,
        Title: rssChannelInfo.title,
        ChannelDesc: rssChannelInfo.description || '',
        TextChannelDesc: rssChannelInfo.description || '',
        ImageUrl: rssChannelInfo.itunes?.image || rssChannelInfo.itunesImage || '',
        Link: rssChannelInfo.link || '',
        FeedLink: feedLink,
        FeedType: rssChannelInfo.itunesType || '',
        Categories: rssChannelInfo.categories || [],
        Author: rssChannelInfo.itunes.author || rssChannelInfo.author || rssChannelInfo.itunesAuthor || '',
        OwnerName: rssChannelInfo.itunesOwner?.name || rssChannelInfo.itunes.owner.name || '',
        OwnerEmail: rssChannelInfo.itunesOwner?.email || rssChannelInfo.itunes.owner.email || '',
        Items: [],
        Count: rssChannelInfo.items.length,
        Copyright: rssChannelInfo.copyright || '',
        Language: rssChannelInfo.language || '',
        TookTime: 0,
        HasThumbnail: false
    };

    return channelInfo
}
