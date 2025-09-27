import { UserInfo, TelegramUser } from "../api/user/types";
import prisma from "../db/prisma.client";
import { v4 as uuidv4 } from 'uuid';
import { UserAlreadyExistsError, DatabaseError } from "./types";

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

export async function createUserFromTelegramInfo(telegramUser: TelegramUser): Promise<UserInfo> {
    // Check if user already exists
    const existingUser = await prisma.user_info.findFirst({
        where: {
            telegram_id: telegramUser.id
        }
    });

    if (existingUser) {
        throw new UserAlreadyExistsError(telegramUser.id);
    }

    // Generate user ID
    const userId = uuidv4();

    // Create nickname from Telegram user info
    const nickname = telegramUser.username ||
        [telegramUser.first_name, telegramUser.last_name]
            .filter(Boolean)
            .join(' ') ||
        `User_${telegramUser.id.substring(0, 8)}`;

    // Create user in database
    const newUser = await prisma.user_info.create({
        data: {
            id: userId,
            telegram_id: telegramUser.id,
            username: telegramUser.username || null,
            nickname: nickname,
            password: '', // Empty password for Telegram users
            email: '', // Empty email
            phone: '', // Empty phone
            avatar: '', // Empty avatar
            reg_date: new Date(),
            update_date: new Date()
        }
    });

    const userInfoData: UserInfo = {
        userId: newUser.id,
        telegramId: newUser.telegram_id || '',
        nickname: newUser.nickname || '',
        password: newUser.password || '',
        email: newUser.email || '',
        phone: newUser.phone || '',
        avatar: newUser.avatar || '',
        regDate: newUser.reg_date || new Date(),
        updateDate: newUser.update_date || new Date()
    }

    return userInfoData;
}
