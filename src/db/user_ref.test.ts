import { describe, it, expect, mock } from 'bun:test'
import { resolveUserIdFromRef } from './user'

function makeFakeDb(rows: Array<{ id: string; nickname: string | null }>) {
  return {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(async () => rows),
        })),
      })),
    })),
  } as any
}

describe('resolveUserIdFromRef()', () => {
  it('resolves nickname to canonical user id', async () => {
    const db = makeFakeDb([{ id: 'user-1234', nickname: 'janedoe' }])
    expect(await resolveUserIdFromRef(db, 'janedoe')).toBe('user-1234')
  })

  it('returns canonical user id when matched directly', async () => {
    const db = makeFakeDb([{ id: 'user-1234', nickname: 'janedoe' }])
    expect(await resolveUserIdFromRef(db, 'user-1234')).toBe('user-1234')
  })

  it('falls back to original ref when user is not found', async () => {
    const db = makeFakeDb([])
    expect(await resolveUserIdFromRef(db, 'unknown-ref')).toBe('unknown-ref')
  })
})
