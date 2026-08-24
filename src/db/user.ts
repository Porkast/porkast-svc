import { eq, or } from 'drizzle-orm'
import { UserInfo, TelegramUser } from "../api/user/types"
import { UserAlreadyExistsError } from "./types"
import { NICKNAME_MAX_LENGTH, normalizeNickname } from "../utils/nickname"
import { randomBytes } from 'crypto'
import * as schema from './schema'

type DbClient = ReturnType<typeof import('./client').createDb>

export async function getUserInfoByTelegramId(db: DbClient, telegramId: string): Promise<UserInfo> {
  const userInfo = await db
    .select()
    .from(schema.userInfo)
    .where(eq(schema.userInfo.telegramId, telegramId || ""))
    .limit(1)

  const row = userInfo[0]
  return {
    userId: row?.id || "",
    telegramId: row?.telegramId || "",
    nickname: row?.nickname || "",
    password: row?.password || "",
    email: row?.email || "",
    phone: row?.phone || "",
    avatar: row?.avatar || "",
    regDate: row?.regDate ? new Date(row.regDate) : new Date(),
    updateDate: row?.updateDate ? new Date(row.updateDate) : new Date(),
  }
}

export async function getUserRowByRef(db: DbClient, userRef: string) {
  const ref = (userRef || '').trim().toLowerCase()
  if (!ref) return null
  const rows = await db
    .select()
    .from(schema.userInfo)
    .where(or(eq(schema.userInfo.id, ref), eq(schema.userInfo.nickname, ref)))
    .limit(1)
  return rows[0] || null
}

export function generateFallbackNickname(): string {
  return `listener-${randomBytes(4).toString('hex')}`
}

export async function ensureUniqueNickname(db: DbClient, desired: string | null, excludeUserId?: string): Promise<string | null> {
  if (!desired) return null
  let nickname = desired
  let suffix = 0
  while (suffix < 10000) {
    const existing = await db
      .select({ id: schema.userInfo.id })
      .from(schema.userInfo)
      .where(eq(schema.userInfo.nickname, nickname))
      .limit(1)
    if (existing.length === 0 || existing[0].id === excludeUserId) {
      return nickname
    }
    suffix += 1
    const tail = `-${suffix}`
    nickname = `${desired.slice(0, NICKNAME_MAX_LENGTH - tail.length)}${tail}`
  }
  return `${desired.slice(0, NICKNAME_MAX_LENGTH - 4)}-rand`
}

export async function createUserFromTelegramInfo(db: DbClient, telegramUser: TelegramUser): Promise<UserInfo> {  const existing = await db
    .select()
    .from(schema.userInfo)
    .where(eq(schema.userInfo.telegramId, telegramUser.id))
    .limit(1)

  if (existing.length > 0) {
    throw new UserAlreadyExistsError(telegramUser.id)
  }

  const userId = crypto.randomUUID()
  const rawNickname = telegramUser.username ||
    [telegramUser.first_name, telegramUser.last_name]
      .filter(Boolean)
      .join(' ') ||
    `User_${telegramUser.id.substring(0, 8)}`
  const desired = normalizeNickname(rawNickname) || generateFallbackNickname()
  const nickname = (await ensureUniqueNickname(db, desired))! as string

  await db.insert(schema.userInfo).values({
    id: userId,
    telegramId: telegramUser.id,
    username: telegramUser.username || null,
    nickname: nickname,
    password: '',
    email: '',
    phone: '',
    avatar: '',
    regDate: new Date().toISOString(),
    updateDate: new Date().toISOString(),
  })

  return {
    userId: userId,
    telegramId: telegramUser.id,
    nickname: nickname,
    password: '',
    email: '',
    phone: '',
    avatar: '',
    regDate: new Date(),
    updateDate: new Date(),
  }
}
