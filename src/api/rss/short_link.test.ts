import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { buildCanonicalPath, resolveShortLink, resolveUserRef } from './short_link'
import type { ShareCodeEntity } from '../../db/share_code'

const resolveShareCodeMock = mock<() => Promise<ShareCodeEntity | null>>(async () => null)
const queryPlaylistByPlaylistIdMock = mock()
const queryUserKeywordSubscriptionDetailMock = mock()
const getUserRowByRefMock = mock()

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

mock.module('../../db/user', () => ({
    getUserRowByRef: getUserRowByRefMock,
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
    it('builds listenlater path with userRef', () => {
        expect(buildCanonicalPath(makeShare(), 'janedoe')).toBe(`/api/rss/listenlater/janedoe`)
    })

    it('builds playlist path with feedRef and userRef', () => {
        expect(buildCanonicalPath(makeShare({ feedType: 'playlist', feedRef: 'pl-9' }), 'janedoe')).toBe(
            `/api/rss/playlist/pl-9/janedoe`,
        )
    })

    it('builds subscription path with encoded keyword', () => {
        expect(buildCanonicalPath(makeShare({ feedType: 'subscription', feedRef: 'AI 播客' }), 'janedoe')).toBe(
            `/api/rss/subscription/janedoe/AI%20%E6%92%AD%E5%AE%A2`,
        )
    })

    it('percent-encodes unicode userRef', () => {
        expect(buildCanonicalPath(makeShare(), '吃播爱好者')).toBe(
            `/api/rss/listenlater/%E5%90%83%E6%92%AD%E7%88%B1%E5%A5%BD%E8%80%85`,
        )
    })
})

describe('resolveUserRef()', () => {
    beforeEach(() => {
        getUserRowByRefMock.mockReset()
    })

    it('returns nickname when it is a valid URL-safe identifier', async () => {
        getUserRowByRefMock.mockResolvedValue({ id: 'user-1234', nickname: 'janedoe' })
        expect(await resolveUserRef(fakeDb, 'user-1234')).toBe('janedoe')
    })

    it('returns nickname when it contains unicode characters', async () => {
        getUserRowByRefMock.mockResolvedValue({ id: 'user-1234', nickname: '吃播爱好者' })
        expect(await resolveUserRef(fakeDb, 'user-1234')).toBe('吃播爱好者')
    })

    it('falls back to userId when nickname is empty', async () => {
        getUserRowByRefMock.mockResolvedValue({ id: 'user-1234', nickname: '' })
        expect(await resolveUserRef(fakeDb, 'user-1234')).toBe('user-1234')
    })

    it('falls back to userId when nickname contains reserved characters', async () => {
        getUserRowByRefMock.mockResolvedValue({ id: 'user-1234', nickname: 'john doe' })
        expect(await resolveUserRef(fakeDb, 'user-1234')).toBe('user-1234')
    })
})

describe('resolveShortLink()', () => {
    beforeEach(() => {
        resolveShareCodeMock.mockReset()
        queryPlaylistByPlaylistIdMock.mockReset()
        queryUserKeywordSubscriptionDetailMock.mockReset()
        getUserRowByRefMock.mockReset()
        getUserRowByRefMock.mockResolvedValue({ id: 'user-1234', nickname: 'janedoe' })
    })

    it('returns path with nickname for active listenlater share', async () => {
        resolveShareCodeMock.mockResolvedValue(makeShare())
        const resolved = await resolveShortLink(fakeDb, 'abc12345')
        expect(resolved).toEqual({ path: '/api/rss/listenlater/janedoe' })
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

    it('returns path with nickname when playlist is active', async () => {
        resolveShareCodeMock.mockResolvedValue(makeShare({ feedType: 'playlist', feedRef: 'pl-9' }))
        queryPlaylistByPlaylistIdMock.mockResolvedValue({ Status: 1 })
        expect(await resolveShortLink(fakeDb, 'abc12345')).toEqual({
            path: `/api/rss/playlist/pl-9/janedoe`,
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
