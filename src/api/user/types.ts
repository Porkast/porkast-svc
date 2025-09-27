import { z } from 'zod';

export const UserSyncSchema = z.object({
    userId: z.string(),
    telegramId: z.string().optional(),
    nickname: z.string().optional(),
    password: z.string().optional(),
    passwordVerify: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    avatar: z.string().optional(),
})

export type UserSyncRequestData = z.infer<typeof UserSyncSchema>

export type TelegramUser = {
  id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
  is_bot?: boolean;
};

export type TelegramUserCreateData = {
  telegramId: string;
  username?: string;
  nickname?: string;
  firstName?: string;
  lastName?: string;
};

export type UserInfo = {
    userId: string,
    telegramId: string,
    nickname: string,
    password: string,
    email: string,
    phone: string,
    avatar: string,
    regDate: Date,
    updateDate: Date
}
