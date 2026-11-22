import { and, eq, inArray, or } from 'drizzle-orm'
import * as schema from '../../db/schema'
import type { DbClient } from '../../db/types'
import { getUserRowByRef, safeDecodeURIComponent } from '../../db/user'
import { queryKeywordSubscriptionFeedItemList, queryUserKeywordSubscriptionDetail } from '../../db/subscription'
import { getUserListenLaterList } from '../listenlater/listen_later'
import { getPlaylistById, getPlaylistPodcastList } from '../playlist/playlist'
import { getPodcastEpisodeMetaFromItunes, lookupPodcastMetadataFromItunes } from '../../utils/itunes'
import { decodeDatabaseText } from '../../utils/text'

export interface OgMetadata {
  title: string
  description: string
  image: string
  siteName: string
  type: 'website' | 'article'
}

export const DEFAULT_OG_IMAGE = 'https://porkast.com/porkast-logo.png'
export const DEFAULT_OG_TITLE = 'Porkast | Discover, Subscribe, Share Your Personalized Podcast'
export const DEFAULT_OG_DESCRIPTION = 'Discover, share, and enjoy podcasts like never before with Porkast. Subscribe, search for keywords, and effortlessly build personalized podcast lists from various channels.'

export const DEFAULT_OG_METADATA: OgMetadata = {
  title: DEFAULT_OG_TITLE,
  description: DEFAULT_OG_DESCRIPTION,
  image: DEFAULT_OG_IMAGE,
  siteName: 'Porkast',
  type: 'website',
}

export function stripHtmlAndTruncate(raw: string, maxLength = 180): string {
  if (!raw) return ''
  const withoutTags = raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
  const decoded = withoutTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
  const collapsed = decoded.replace(/\s+/g, ' ').trim()
  if (!collapsed) return ''
  if (collapsed.length <= maxLength) return collapsed
  return `${collapsed.slice(0, maxLength - 1).trimEnd()}…`
}

export function normalizePreviewImageUrl(url?: string | null): string {
  const trimmed = (url || '').trim()
  if (!trimmed) return DEFAULT_OG_IMAGE
  if (trimmed.startsWith('https://')) return trimmed
  if (trimmed.startsWith('http://')) {
    return `https://${trimmed.slice('http://'.length)}`
  }
  return DEFAULT_OG_IMAGE
}

export function getEpisodeIdCandidates(rawParam: string, search: string = ''): string[] {
  if (!rawParam) return []

  const candidates = new Set<string>()
  const addVariants = (value: string) => {
    if (!value) return
    candidates.add(value)
    const restoredProtocol = value.replace(/^(https?):\/(?!\/)/i, '$1://')
    candidates.add(restoredProtocol)
    if (search) {
      const normalizedSearch = search.startsWith('?') ? search : `?${search}`
      candidates.add(`${value}${normalizedSearch}`)
      candidates.add(`${restoredProtocol}${normalizedSearch}`)
    }
  }

  let current = rawParam
  for (let i = 0; i < 3; i++) {
    addVariants(current)
    const decoded = safeDecodeURIComponent(current)
    if (decoded === current) break
    current = decoded
  }

  return Array.from(candidates)
}

function resolveUserDisplayName(
  user: { nickname?: string | null; email?: string | null } | null | undefined,
  fallback: string
): string {
  const nickname = (user?.nickname || '').trim()
  if (nickname) return nickname
  const emailPrefix = (user?.email || '').split('@')[0]?.trim()
  if (emailPrefix) return emailPrefix
  return fallback
}

export async function resolveChannelOg(db: DbClient, channelId: string): Promise<OgMetadata> {
  const cleanChannelId = safeDecodeURIComponent(channelId).trim()
  if (!cleanChannelId) return DEFAULT_OG_METADATA

  const dbChannel = await db
    .select()
    .from(schema.feedChannel)
    .where(or(eq(schema.feedChannel.feedId, cleanChannelId), eq(schema.feedChannel.id, cleanChannelId)))
    .limit(1)
    .then((rows) => rows[0] || null)
    .catch(() => null)

  let title = (dbChannel?.title || '').trim()
  let author = (dbChannel?.author || '').trim()
  let description = stripHtmlAndTruncate(dbChannel?.channelDesc || '')
  let image = (dbChannel?.imageUrl || '').trim()

  if (!title || !image) {
    try {
      const itunesMeta = await lookupPodcastMetadataFromItunes(cleanChannelId)
      if (itunesMeta) {
        if (!title && itunesMeta.title) title = itunesMeta.title.trim()
        if (!author && itunesMeta.author) author = itunesMeta.author.trim()
        if (!image && itunesMeta.imageUrl) image = itunesMeta.imageUrl.trim()
      }
    } catch {
      // ignore upstream lookup errors and fall back to D1/default
    }
  }

  if (!title || !image) {
    const dbItem = await db
      .select({
        channelTitle: schema.feedItem.channelTitle,
        author: schema.feedItem.author,
        imageUrl: schema.feedItem.imageUrl,
      })
      .from(schema.feedItem)
      .where(eq(schema.feedItem.feedId, cleanChannelId))
      .limit(1)
      .then((rows) => rows[0] || null)
      .catch(() => null)

    if (dbItem) {
      if (!title && dbItem.channelTitle) title = dbItem.channelTitle.trim()
      if (!author && dbItem.author) author = dbItem.author.trim()
      if (!image && dbItem.imageUrl) image = dbItem.imageUrl.trim()
    }
  }

  if (!title) {
    return DEFAULT_OG_METADATA
  }

  const resolvedDescription =
    description ||
    (author ? `${title} by ${author} on Porkast.` : `Listen to ${title} on Porkast.`)

  return {
    title: `${title} – Porkast`,
    description: resolvedDescription,
    image: normalizePreviewImageUrl(image),
    siteName: 'Porkast',
    type: 'website',
  }
}

export async function resolveEpisodeOg(
  db: DbClient,
  channelId: string,
  rawEpisodeId: string,
  rawSearch: string = ''
): Promise<OgMetadata> {
  const cleanChannelId = safeDecodeURIComponent(channelId).trim()
  const candidates = getEpisodeIdCandidates(rawEpisodeId, rawSearch)
  if (!cleanChannelId || candidates.length === 0) {
    return cleanChannelId ? resolveChannelOg(db, cleanChannelId) : DEFAULT_OG_METADATA
  }

  let dbEpisode = await db
    .select()
    .from(schema.feedItem)
    .where(and(eq(schema.feedItem.feedId, cleanChannelId), inArray(schema.feedItem.guid, candidates)))
    .limit(1)
    .then((rows) => rows[0] || null)
    .catch(() => null)

  if (!dbEpisode) {
    dbEpisode = await db
      .select()
      .from(schema.feedItem)
      .where(inArray(schema.feedItem.guid, candidates))
      .limit(1)
      .then((rows) => rows[0] || null)
      .catch(() => null)
  }

  if (dbEpisode && (dbEpisode.title || '').trim()) {
    const episodeTitle = (dbEpisode.title || '').trim()
    const channelTitle = (dbEpisode.channelTitle || '').trim()
    const author = (dbEpisode.author || '').trim()
    const rawDesc = decodeDatabaseText(dbEpisode.description)
    const description =
      stripHtmlAndTruncate(rawDesc) ||
      (channelTitle ? `Listen to ${episodeTitle} from ${channelTitle} on Porkast.` : DEFAULT_OG_DESCRIPTION)

    let image = (dbEpisode.imageUrl || '').trim()
    if (!image) {
      const dbChannel = await db
        .select({ imageUrl: schema.feedChannel.imageUrl })
        .from(schema.feedChannel)
        .where(or(eq(schema.feedChannel.feedId, cleanChannelId), eq(schema.feedChannel.id, dbEpisode.channelId)))
        .limit(1)
        .then((rows) => rows[0] || null)
        .catch(() => null)
      image = (dbChannel?.imageUrl || '').trim()
    }

    if (!image) {
      try {
        const itunesMeta = await lookupPodcastMetadataFromItunes(cleanChannelId)
        if (itunesMeta?.imageUrl) {
          image = itunesMeta.imageUrl.trim()
        }
      } catch {
        // ignore
      }
    }

    const title = channelTitle
      ? `${episodeTitle} – ${channelTitle}`
      : author
        ? `${episodeTitle} – ${author}`
        : `${episodeTitle} – Porkast`

    return {
      title,
      description,
      image: normalizePreviewImageUrl(image),
      siteName: 'Porkast',
      type: 'article',
    }
  }

  try {
    const itunesEpisode = await getPodcastEpisodeMetaFromItunes(cleanChannelId, candidates)
    if (itunesEpisode && itunesEpisode.title.trim()) {
      const episodeTitle = itunesEpisode.title.trim()
      const channelTitle = itunesEpisode.channelTitle.trim()
      const description =
        stripHtmlAndTruncate(itunesEpisode.description) ||
        (channelTitle ? `Listen to ${episodeTitle} from ${channelTitle} on Porkast.` : DEFAULT_OG_DESCRIPTION)

      return {
        title: channelTitle ? `${episodeTitle} – ${channelTitle}` : `${episodeTitle} – Porkast`,
        description,
        image: normalizePreviewImageUrl(itunesEpisode.imageUrl),
        siteName: 'Porkast',
        type: 'article',
      }
    }
  } catch {
    // ignore and fall back to channel metadata
  }

  return resolveChannelOg(db, cleanChannelId)
}

export async function resolveSubscriptionOg(
  db: DbClient,
  rawUserRef: string,
  rawKeyword: string
): Promise<OgMetadata> {
  const userRef = safeDecodeURIComponent(rawUserRef).trim()
  const keyword = safeDecodeURIComponent(rawKeyword).trim()
  if (!userRef || !keyword) return DEFAULT_OG_METADATA

  const user = await getUserRowByRef(db, userRef).catch(() => null)
  const ownerName = resolveUserDisplayName(user, userRef)
  const resolvedUserId = user?.id || userRef

  let firstImage = ''
  try {
    const subInfo = await queryUserKeywordSubscriptionDetail(db, resolvedUserId, keyword)
    const [items] = await queryKeywordSubscriptionFeedItemList(
      db,
      resolvedUserId,
      keyword,
      subInfo.Source,
      subInfo.Country,
      subInfo.ExcludeFeedId,
      0,
      1
    )
    firstImage = items?.[0]?.ImageUrl || items?.[0]?.ChannelImageUrl || ''
  } catch {
    // ignore
  }

  return {
    title: `#${keyword} – ${ownerName}'s Podcast Subscription`,
    description: `Follow #${keyword} podcast episodes curated by ${ownerName} on Porkast.`,
    image: normalizePreviewImageUrl(firstImage),
    siteName: 'Porkast',
    type: 'website',
  }
}

export async function resolveListenLaterOg(db: DbClient, rawUserRef: string): Promise<OgMetadata> {
  const userRef = safeDecodeURIComponent(rawUserRef).trim()
  if (!userRef) return DEFAULT_OG_METADATA

  const user = await getUserRowByRef(db, userRef).catch(() => null)
  const ownerName = resolveUserDisplayName(user, userRef)
  const resolvedUserId = user?.id || userRef

  let firstImage = ''
  try {
    const items = await getUserListenLaterList(db, resolvedUserId, 1, 0)
    firstImage = items?.[0]?.image_url || items?.[0]?.channel_image_url || ''
  } catch {
    // ignore
  }

  return {
    title: `${ownerName}'s Listen Later – Porkast`,
    description: `Podcast episodes saved by ${ownerName} on Porkast.`,
    image: normalizePreviewImageUrl(firstImage),
    siteName: 'Porkast',
    type: 'website',
  }
}

export async function resolvePlaylistOg(
  db: DbClient,
  rawUserRef: string,
  rawPlaylistId: string
): Promise<OgMetadata> {
  const userRef = safeDecodeURIComponent(rawUserRef).trim()
  const playlistId = safeDecodeURIComponent(rawPlaylistId).trim()
  if (!userRef || !playlistId) return DEFAULT_OG_METADATA

  const [playlistResult, user] = await Promise.all([
    getPlaylistById(db, playlistId).catch(() => null),
    getUserRowByRef(db, userRef).catch(() => null),
  ])

  const ownerName = resolveUserDisplayName(
    user || playlistResult?.userInfo,
    userRef
  )
  const resolvedUserId = user?.id || playlistResult?.userInfo?.userId || userRef
  const playlistName = (playlistResult?.playlist?.PlaylistName || '').trim() || 'Playlist'
  const playlistDesc = stripHtmlAndTruncate(playlistResult?.playlist?.Description || '')

  let firstImage = ''
  try {
    const itemsResult = await getPlaylistPodcastList(db, resolvedUserId, playlistId, '1', '0')
    firstImage = itemsResult.playlist?.[0]?.ImageUrl || itemsResult.playlist?.[0]?.ChannelImageUrl || ''
  } catch {
    // ignore
  }

  return {
    title: `${playlistName} – ${ownerName}'s Playlist`,
    description: playlistDesc || `Curated podcast playlist "${playlistName}" by ${ownerName} on Porkast.`,
    image: normalizePreviewImageUrl(firstImage),
    siteName: 'Porkast',
    type: 'website',
  }
}
