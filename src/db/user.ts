import { eq } from 'drizzle-orm'
import { UserInfo, TelegramUser } from "../api/user/types"
import { UserAlreadyExistsError } from "./types"
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

export async function createUserFromTelegramInfo(db: DbClient, telegramUser: TelegramUser): Promise<UserInfo> {
  const existing = await db
    .select()
    .from(schema.userInfo)
    .where(eq(schema.userInfo.telegramId, telegramUser.id))
    .limit(1)

  if (existing.length > 0) {
    throw new UserAlreadyExistsError(telegramUser.id)
  }

  const userId = crypto.randomUUID()
  const nickname = telegramUser.username ||
    [telegramUser.first_name, telegramUser.last_name]
      .filter(Boolean)
      .join(' ') ||
    `User_${telegramUser.id.substring(0, 8)}`

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
