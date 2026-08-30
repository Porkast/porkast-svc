import { getOrCreateShareCode, resolveShareCode } from '../../db/share_code'
import type { ShareCodeEntity, ShareCodeFeedType } from '../../db/share_code'
import { queryPlaylistByPlaylistId } from '../../db/playlist'
import { queryUserKeywordSubscriptionDetail } from '../../db/subscription'

type DbClient = ReturnType<typeof import('../../db/client').createDb>

export interface ResolvedShortLink {
  path: string
}

export async function createShareCodeForFeed(
  db: DbClient,
  userId: string,
  feedType: ShareCodeFeedType,
  feedRef: string,
): Promise<ShareCodeEntity> {
  return getOrCreateShareCode(db, userId, feedType, feedRef)
}

export function buildCanonicalPath(share: ShareCodeEntity): string {
  switch (share.feedType) {
    case 'listenlater':
      return `/api/rss/listenlater/${encodeURIComponent(share.userId)}`
    case 'playlist':
      return `/api/rss/playlist/${encodeURIComponent(share.feedRef)}/${encodeURIComponent(share.userId)}`
    case 'subscription':
      return `/api/rss/subscription/${encodeURIComponent(share.userId)}/${encodeURIComponent(share.feedRef)}`
  }
}

export async function resolveShortLink(db: DbClient, code: string): Promise<ResolvedShortLink | null> {
  const share = await resolveShareCode(db, code)
  if (!share) {
    return null
  }

  if (share.feedType === 'playlist') {
    const playlist = await queryPlaylistByPlaylistId(db, share.feedRef)
    if (!playlist || playlist.Status !== 1) {
      return null
    }
  }

  if (share.feedType === 'subscription') {
    try {
      const subscription = await queryUserKeywordSubscriptionDetail(db, share.userId, share.feedRef)
      if (subscription.Status !== 1) {
        return null
      }
    } catch {
      return null
    }
  }

  return { path: buildCanonicalPath(share) }
}
