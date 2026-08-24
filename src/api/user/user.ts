import { eq } from 'drizzle-orm'
import { UserSyncRequestData } from "./types"
import { userInfo } from "../../db/schema"
import { isValidNicknameFormat } from "../../utils/nickname"
import type { DbClient } from '../../db/types'

export type SyncUserDataResult = {
    code: number
    msg: string
}

export type UpdateNicknameResult = SyncUserDataResult & { nickname?: string | null }

export async function updateUserNickname(db: DbClient, userId: string, rawNickname: string): Promise<UpdateNicknameResult> {
    const now = new Date().toISOString()
    if (rawNickname.trim() === '') {
        await db.update(userInfo).set({ nickname: null, updateDate: now }).where(eq(userInfo.id, userId))
        return { code: 0, msg: 'Success', nickname: null }
    }
    const trimmed = rawNickname.trim().toLowerCase()
    if (!isValidNicknameFormat(trimmed)) {
        return { code: 1, msg: 'Nickname may not contain spaces or URL-reserved characters, and is limited to 32 characters' }
    }
    const taken = await db
        .select({ id: userInfo.id })
        .from(userInfo)
        .where(eq(userInfo.nickname, trimmed))
        .limit(1)
    if (taken.length > 0 && taken[0].id !== userId) {
        return { code: 1, msg: 'Nickname is already in use' }
    }
    await db.update(userInfo).set({ nickname: trimmed, updateDate: now }).where(eq(userInfo.id, userId))
    return { code: 0, msg: 'Success', nickname: trimmed }
}

export async function syncUserData(db: DbClient, userData: UserSyncRequestData): Promise<SyncUserDataResult> {
    const existing = await db
        .select()
        .from(userInfo)
        .where(eq(userInfo.id, userData.userId))
        .limit(1)

    const now = new Date().toISOString()

    if (existing.length > 0) {
        const updateData: Record<string, any> = { updateDate: now }
        if (userData.nickname !== undefined) {
            const result = await updateUserNickname(db, userData.userId, userData.nickname)
            if (result.code !== 0) return result
            updateData.nickname = result.nickname
        }
        if (userData.avatar) updateData.avatar = userData.avatar
        if (userData.phone) updateData.phone = userData.phone
        if (userData.password) updateData.password = userData.password
        if (userData.email !== undefined) updateData.email = userData.email

        await db
            .update(userInfo)
            .set(updateData)
            .where(eq(userInfo.id, userData.userId))
    } else {
        let nickname: string | null = null
        if (userData.nickname !== undefined && userData.nickname !== '') {
            const trimmed = userData.nickname.trim().toLowerCase()
            if (!isValidNicknameFormat(trimmed)) {
                return { code: 1, msg: 'Nickname may not contain spaces or URL-reserved characters, and is limited to 32 characters' }
            }
            const taken = await db
                .select({ id: userInfo.id })
                .from(userInfo)
                .where(eq(userInfo.nickname, trimmed))
                .limit(1)
            if (taken.length > 0) {
                return { code: 1, msg: 'Nickname is already in use' }
            }
            nickname = trimmed
        }
        await db.insert(userInfo).values({
            id: userData.userId,
            nickname: nickname,
            password: userData.password || null,
            email: userData.email || null,
            phone: userData.phone || null,
            avatar: userData.avatar || null,
            regDate: now,
            updateDate: now,
        })
    }

    return { code: 0, msg: 'Success' }
}
