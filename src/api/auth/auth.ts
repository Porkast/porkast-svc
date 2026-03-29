import { createHash, randomBytes, randomInt, randomUUID } from 'crypto';
import prisma from '../../db/prisma.client';
import { sendLoginOtpEmail } from '../../email/resend';
import { logger } from '../../utils/logger';
import type { AuthUser, VerifyOtpResult } from './types';

const OTP_EXPIRY_MINUTES = 10;
const SESSION_EXPIRY_DAYS = 30;
const SESSION_PREFIX_LENGTH = 12;

type AuthPrismaClient = {
  verification_token: {
    deleteMany: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    findFirst: (args: any) => Promise<any>;
  };
  user_info: {
    findFirst: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  app_session: {
    create: (args: any) => Promise<any>;
    findFirst: (args: any) => Promise<any>;
    updateMany: (args: any) => Promise<any>;
  };
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function getBearerToken(authorizationHeader?: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  if (authorizationHeader.startsWith('Bearer ')) {
    return authorizationHeader.slice(7).trim() || null;
  }

  return authorizationHeader.trim() || null;
}

export async function createEmailOtpChallenge(email: string) {
  const db = prisma as unknown as AuthPrismaClient;
  const normalizedEmail = normalizeEmail(email);
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await db.verification_token.deleteMany({
    where: {
      email: normalizedEmail,
    },
  });

  await db.verification_token.create({
    data: {
      email: normalizedEmail,
      token: hashValue(code),
      expires_at: expiresAt,
    },
  });

  await sendLoginOtpEmail(normalizedEmail, code, OTP_EXPIRY_MINUTES);

  return {
    expiresIn: OTP_EXPIRY_MINUTES * 60,
    resendAfter: 60,
  };
}

export async function verifyEmailOtp(email: string, code: string, nickname?: string): Promise<VerifyOtpResult> {
  const db = prisma as unknown as AuthPrismaClient;
  const normalizedEmail = normalizeEmail(email);
  const hashedCode = hashValue(code);
  const now = new Date();

  const tokenRecord = await db.verification_token.findFirst({
    where: {
      email: normalizedEmail,
      token: hashedCode,
      expires_at: {
        gt: now,
      },
    },
  });

  if (!tokenRecord) {
    throw new Error('Invalid or expired verification code');
  }

  await db.verification_token.deleteMany({
    where: {
      email: normalizedEmail,
    },
  });

  let userInfo = await db.user_info.findFirst({
    where: {
      email: normalizedEmail,
    },
  });

  let isNewUser = false;
  const finalNickname = sanitizeNickname(nickname, normalizedEmail);

  if (!userInfo) {
    isNewUser = true;
    userInfo = await db.user_info.create({
      data: {
        id: randomUUID(),
        email: normalizedEmail,
        nickname: finalNickname,
        password: '',
        phone: '',
        avatar: '',
        reg_date: now,
        update_date: now,
      },
    });
  } else if ((!userInfo.nickname || userInfo.nickname.trim().length === 0) && finalNickname.length > 0) {
    userInfo = await db.user_info.update({
      where: {
        id: userInfo.id,
      },
      data: {
        nickname: finalNickname,
        update_date: now,
      },
    });
  }

  const sessionToken = buildSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.app_session.create({
    data: {
      user_id: userInfo.id,
      token_hash: hashValue(sessionToken),
      expires_at: expiresAt,
    },
  });

  return {
    isNewUser,
    user: mapAuthUser(userInfo),
    session: {
      token: sessionToken,
      expiresAt,
    },
  };
}

export async function getSessionUser(token: string): Promise<AuthUser | null> {
  const db = prisma as unknown as AuthPrismaClient;
  const tokenHash = hashValue(token);
  const now = new Date();

  const session = await db.app_session.findFirst({
    where: {
      token_hash: tokenHash,
      revoked_at: null,
      expires_at: {
        gt: now,
      },
    },
  });

  if (!session) {
    return null;
  }

  const userInfo = await db.user_info.findFirst({
    where: {
      id: session.user_id,
    },
  });

  if (!userInfo) {
    logger.warn(`No user found for session ${session.id}`);
    return null;
  }

  return mapAuthUser(userInfo);
}

export async function revokeSession(token: string): Promise<void> {
  const db = prisma as unknown as AuthPrismaClient;
  const tokenHash = hashValue(token);

  await db.app_session.updateMany({
    where: {
      token_hash: tokenHash,
      revoked_at: null,
    },
    data: {
      revoked_at: new Date(),
    },
  });
}

function buildSessionToken(): string {
  return `${randomUUID().replace(/-/g, '')}.${randomBytes(24).toString('hex')}`;
}

function sanitizeNickname(nickname: string | undefined, email: string): string {
  const trimmedNickname = nickname?.trim();
  if (trimmedNickname && trimmedNickname.length > 0) {
    return trimmedNickname.slice(0, 128);
  }

  return email.split('@')[0].slice(0, 128) || `listener-${randomBytes(6).toString('hex').slice(0, SESSION_PREFIX_LENGTH)}`;
}

function mapAuthUser(userInfo: {
  id: string;
  telegram_id: string | null;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  avatar: string | null;
}): AuthUser {
  return {
    userId: userInfo.id,
    telegramId: userInfo.telegram_id || '',
    nickname: userInfo.nickname || '',
    email: userInfo.email || '',
    phone: userInfo.phone || '',
    avatar: userInfo.avatar || '',
  };
}
