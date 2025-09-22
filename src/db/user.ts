import { UserInfo } from "../api/user/types";
import prisma from "../db/prisma.client";

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