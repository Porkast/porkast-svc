import { and, eq, isNull } from 'drizzle-orm'
import * as schema from './schema'

type DbClient = ReturnType<typeof import('./client').createDb>

export type ShareCodeFeedType = 'listenlater' | 'subscription' | 'playlist'

export interface ShareCodeEntity {
  id: string
  code: string
  userId: string
  feedType: ShareCodeFeedType
  feedRef: string
  createdAt: string
  revokedAt: string | null
}

const CODE_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function generateShareCode(length: number = 8): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let code = ''
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return code
}

export async function getOrCreateShareCode(
  db: DbClient,
  userId: string,
  feedType: ShareCodeFeedType,
  feedRef: string,
): Promise<ShareCodeEntity> {
  const existing = await db
    .select()
    .from(schema.shareCode)
    .where(
      and(
        eq(schema.shareCode.userId, userId),
        eq(schema.shareCode.feedType, feedType),
        eq(schema.shareCode.feedRef, feedRef),
      ),
    )
    .limit(1)

  if (existing[0]) {
    const row = existing[0]
    if (!row.revokedAt) {
      return mapRow(row)
    }
    const code = generateShareCode()
    await db
      .update(schema.shareCode)
      .set({ code, revokedAt: null })
      .where(eq(schema.shareCode.id, row.id))
    return { ...mapRow(row), code, revokedAt: null }
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const row = {
        id: crypto.randomUUID(),
        code: generateShareCode(),
        userId,
        feedType,
        feedRef,
        createdAt: new Date().toISOString(),
        revokedAt: null,
      }
      await db.insert(schema.shareCode).values(row)
      return row
    } catch (error) {
      // `code` unique conflict; retry with a fresh code
    }
  }
  throw new Error('Failed to create share code')
}

export async function resolveShareCode(db: DbClient, code: string): Promise<ShareCodeEntity | null> {
  const rows = await db
    .select()
    .from(schema.shareCode)
    .where(eq(schema.shareCode.code, code))
    .limit(1)

  if (rows.length === 0 || rows[0].revokedAt) {
    return null
  }
  return mapRow(rows[0])
}

export async function revokeShareCodesForFeed(
  db: DbClient,
  feedType: ShareCodeFeedType,
  feedRef: string,
  userId?: string,
): Promise<void> {
  await db
    .update(schema.shareCode)
    .set({ revokedAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.shareCode.feedType, feedType),
        eq(schema.shareCode.feedRef, feedRef),
        isNull(schema.shareCode.revokedAt),
        userId ? eq(schema.shareCode.userId, userId) : undefined,
      ),
    )
}

function mapRow(row: typeof schema.shareCode.$inferSelect): ShareCodeEntity {
  return {
    id: row.id,
    code: row.code,
    userId: row.userId,
    feedType: row.feedType as ShareCodeFeedType,
    feedRef: row.feedRef,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  }
}
