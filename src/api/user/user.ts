import { UserInfo as UserInfo, UserSyncRequestData, UserSyncSchema } from "./types";
import prisma from "../../db/prisma.client";
import { Prisma } from "@prisma/client";

export async function syncUserData(userData: UserSyncRequestData) {
    
    const queryData = await prisma.user_info.findUnique({
        where: {
            id: userData.userId
        }
    })

    if (queryData) {
        const userInfoUpdate: Prisma.user_infoUpdateInput = {}
        if (userData.nickname) {
            userInfoUpdate.nickname = userData.nickname
        }
        if (userData.avatar) {
            userInfoUpdate.avatar = userData.avatar
        }
        if (userData.phone) {
            userInfoUpdate.phone = userData.phone
        }
        if (userData.password) {
            userInfoUpdate.password = userData.password
        }
        userInfoUpdate.email = userData.email
        userInfoUpdate.update_date = new Date()
        await prisma.user_info.update({
            where: {
                id: userData.userId
            },
            data: userInfoUpdate
        })
    } else {
        await prisma.user_info.create({
            data: {
                id: userData.userId,
                nickname: userData.nickname,
                password: userData.password,
                email: userData.email,
                phone: userData.phone,
                avatar: userData.avatar,
                reg_date: new Date(),
                update_date: new Date(),
            }
        })
    }
}

export async function getUserInfoByTelegramId(telegramId: string): Promise<UserInfo> {

    let userInfo = await prisma.user_info.findFirst({
        where: {
            telegram_id: telegramId || ""
        }
    })

    const userInfoData: UserInfo = {
        userId: userInfo?.id || "",
        telegramId: userInfo?.telegram_id || "",
        nickname: userInfo?.nickname || "",
        password: userInfo?.password || "",
        email: userInfo?.email || "",
        phone: userInfo?.phone || "",
        avatar: userInfo?.avatar || "",
        regDate: userInfo?.reg_date || new Date(),
        updateDate: userInfo?.update_date || new Date()
    }

    return userInfoData
}