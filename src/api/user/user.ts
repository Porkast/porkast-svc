import { eq } from 'drizzle-orm'
import { UserSyncRequestData } from "./types"
import { userInfo } from "../../db/schema"
import type { DbClient } from '../../db/types'

export async function syncUserData(db: DbClient, userData: UserSyncRequestData) {
    const existing = await db
        .select()
        .from(userInfo)
        .where(eq(userInfo.id, userData.userId))
        .limit(1)

    const now = new Date().toISOString()

    if (existing.length > 0) {
        const updateData: Record<string, any> = { updateDate: now }
        if (userData.nickname) updateData.nickname = userData.nickname
        if (userData.avatar) updateData.avatar = userData.avatar
        if (userData.phone) updateData.phone = userData.phone
        if (userData.password) updateData.password = userData.password
        if (userData.email !== undefined) updateData.email = userData.email

        await db
            .update(userInfo)
            .set(updateData)
            .where(eq(userInfo.id, userData.userId))
    } else {
        await db.insert(userInfo).values({
            id: userData.userId,
            nickname: userData.nickname || null,
            password: userData.password || null,
            email: userData.email || null,
            phone: userData.phone || null,
            avatar: userData.avatar || null,
            regDate: now,
            updateDate: now,
        })
    }
}
