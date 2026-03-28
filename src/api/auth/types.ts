import { z } from 'zod';

export const EmailOtpRequestSchema = z.object({
  email: z.string().trim().email(),
});

export type EmailOtpRequestData = z.infer<typeof EmailOtpRequestSchema>;

export const EmailOtpVerifySchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().length(6),
  nickname: z.string().trim().min(1).max(128).optional(),
});

export type EmailOtpVerifyData = z.infer<typeof EmailOtpVerifySchema>;

export type AuthUser = {
  userId: string;
  telegramId: string;
  nickname: string;
  email: string;
  phone: string;
  avatar: string;
};

export type SessionPayload = {
  token: string;
  expiresAt: Date;
};

export type VerifyOtpResult = {
  isNewUser: boolean;
  user: AuthUser;
  session: SessionPayload;
};
