import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { buildCanonicalPath, resolveShortLink } from './short_link'
import type { ShareCodeEntity } from '../../db/share_code'

const resolveShareCodeMock = mock<() => Promise<ShareCodeEntity | null>>(async () => null)
const queryPlaylistByPlaylistIdMock = mock()
const queryUserKeywordSubscriptionDetailMock = mock()

mock.module('../../db/share_code', () => ({
    resolveShareCode: resolveShareCodeMock,
    getOrCreateShareCode: mock(async () => ({})),
}))

mock.module('../../db/playlist', () => ({
    queryPlaylistByPlaylistId: queryPlaylistByPlaylistIdMock,
}))

mock.module('../../db/subscription', () => ({
    queryUserKeywordSubscriptionDetail: queryUserKeywordSubscriptionDetailMock,
}))

const fakeDb = {} as any

function makeShare(overrides: Partial<ShareCodeEntity> = {}): ShareCodeEntity {
    return {
        id: 'id-1',
        code: 'abc12345',
        userId: 'user-1234',
        feedType: 'listenlater',
        feedRef: '',
        createdAt: '2026-08-30T00:00:00.000Z',
        revokedAt: null,
        ...overrides,
    }
}

describe('buildCanonicalPath()', () => {
    it('builds listenlater path with userId', () => {
        expect(buildCanonicalPath(makeShare())).toBe(`/api/rss/listenlater/user-1234`)
    })

    it('builds playlist path with feedRef and userId', () => {
        expect(buildCanonicalPath(makeShare({ feedType: 'playlist', feedRef: 'pl-9' }))).toBe(
            `/api/rss/playlist/pl-9/user-1234`,
        )
    })

    it('builds subscription path with encoded keyword', () => {
        expect(buildCanonicalPath(makeShare({ feedType: 'subscription', feedRef: 'AI 播客' }))).toBe(
            `/api/rss/subscription/user-1234/AI%20%E6%92%AD%E5%AE%A2`,
        )
    })
})

describe('resolveShortLink()', () => {
    beforeEach(() => {
        resolveShareCodeMock.mockReset()
        queryPlaylistByPlaylistIdMock.mockReset()
        queryUserKeywordSubscriptionDetailMock.mockReset()
    })

    it('returns path for active listenlater share', async () => {
        resolveShareCodeMock.mockResolvedValue(makeShare())
        const resolved = await resolveShortLink(fakeDb, 'abc12345')
        expect(resolved).toEqual({ path: '/api/rss/listenlater/user-1234' })
    })

    it('returns null when code is missing or revoked', async () => {
        resolveShareCodeMock.mockResolvedValue(null)
        expect(await resolveShortLink(fakeDb, 'nope')).toBeNull()
    })

    it('returns null when playlist was deleted', async () => {
        resolveShareCodeMock.mockResolvedValue(makeShare({ feedType: 'playlist', feedRef: 'pl-9' }))
        queryPlaylistByPlaylistIdMock.mockResolvedValue({ Status: 0 })
        expect(await resolveShortLink(fakeDb, 'abc12345')).toBeNull()
    })

    it('returns path when playlist is active', async () => {
        resolveShareCodeMock.mockResolvedValue(makeShare({ feedType: 'playlist', feedRef: 'pl-9' }))
        queryPlaylistByPlaylistIdMock.mockResolvedValue({ Status: 1 })
        expect(await resolveShortLink(fakeDb, 'abc12345')).toEqual({
            path: `/api/rss/playlist/pl-9/user-1234`,
        })
    })

    it('returns null when subscription is disabled', async () => {
        resolveShareCodeMock.mockResolvedValue(makeShare({ feedType: 'subscription', feedRef: 'AI' }))
        queryUserKeywordSubscriptionDetailMock.mockResolvedValue({ Status: 0 })
        expect(await resolveShortLink(fakeDb, 'abc12345')).toBeNull()
    })

    it('returns null when subscription lookup fails', async () => {
        resolveShareCodeMock.mockResolvedValue(makeShare({ feedType: 'subscription', feedRef: 'AI' }))
        queryUserKeywordSubscriptionDetailMock.mockRejectedValue(new Error('Subscription not found'))
        expect(await resolveShortLink(fakeDb, 'abc12345')).toBeNull()
    })
})
