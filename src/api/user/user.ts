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

