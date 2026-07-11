import { createHash, randomBytes, randomInt, randomUUID } from 'crypto';
import { eq, and, gt, desc, sql, isNull } from 'drizzle-orm';
import { createDb } from '../../db/client';
import { verificationToken, userInfo as userInfoTable, appSession, userMembership } from '../../db/schema';
import { sendLoginOtpEmail, sendAdminNewUserEmail } from '../../email/resend';
import { logger } from '../../utils/logger';
import type { AuthUser, VerifyOtpResult } from './types';
import type { Env } from '../../env';

const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const SESSION_EXPIRY_DAYS = 30;
const SESSION_PREFIX_LENGTH = 12;

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

function isDemoEmail(email: string, env: Env): boolean {
  const demoEmails = (env.DEMO_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return demoEmails.includes(email);
}

function getDemoCode(env: Env): string {
  return (env.DEMO_CODE || '000000').padStart(6, '0').slice(0, 6);
}

export async function createEmailOtpChallenge(env: Env, email: string) {
  const db = createDb(env.DB);
  const normalizedEmail = normalizeEmail(email);
  const recentToken = await db
    .select()
    .from(verificationToken)
    .where(eq(verificationToken.email, normalizedEmail))
    .orderBy(desc(verificationToken.createdAt))
    .limit(1);

  if (recentToken.length > 0) {
    const elapsed = Math.floor((Date.now() - new Date(recentToken[0].createdAt).getTime()) / 1000);
    const remaining = RESEND_COOLDOWN_SECONDS - elapsed;
    if (remaining > 0) {
      throw new Error(`Resend too soon: ${remaining}`);
    }
  }

  const isDemo = isDemoEmail(normalizedEmail, env);
  const code = isDemo ? getDemoCode(env) : randomInt(0, 1_000_000).toString().padStart(6, '0');
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await db
    .delete(verificationToken)
    .where(eq(verificationToken.email, normalizedEmail));

  await db.insert(verificationToken).values({
    id: randomUUID(),
    email: normalizedEmail,
    token: hashValue(code),
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
  });

  if (!isDemo) {
    await sendLoginOtpEmail(env.RESEND_API_KEY, normalizedEmail, code, OTP_EXPIRY_MINUTES);
  } else {
    logger.info(`Demo OTP requested for ${normalizedEmail}`);
  }

  return {
    expiresIn: OTP_EXPIRY_MINUTES * 60,
    resendAfter: RESEND_COOLDOWN_SECONDS,
  };
}

export async function verifyEmailOtp(env: Env, email: string, code: string, nickname?: string): Promise<VerifyOtpResult> {
  const db = createDb(env.DB);
  const normalizedEmail = normalizeEmail(email);
  const hashedCode = hashValue(code);
  const now = new Date();

  const tokenRecord = await db
    .select()
    .from(verificationToken)
    .where(
      and(
        eq(verificationToken.email, normalizedEmail),
        eq(verificationToken.token, hashedCode),
        gt(verificationToken.expiresAt, now.toISOString()),
      )
    )
    .limit(1);

  if (tokenRecord.length === 0) {
    throw new Error('Invalid or expired verification code');
  }

  await db
    .delete(verificationToken)
    .where(eq(verificationToken.email, normalizedEmail));

  let userRecords = await db
    .select()
    .from(userInfoTable)
    .where(eq(userInfoTable.email, normalizedEmail))
    .limit(1);

  let isNewUser = false;
  const finalNickname = sanitizeNickname(nickname, normalizedEmail);
  let currentUser = userRecords[0];

  if (!currentUser) {
    isNewUser = true;
    const newId = randomUUID();
    const regDateStr = now.toISOString();
    await db.insert(userInfoTable).values({
      id: newId,
      email: normalizedEmail,
      nickname: finalNickname,
      password: '',
      phone: '',
      avatar: '',
      regDate: regDateStr,
      updateDate: regDateStr,
    });
    const newUser = await db.select().from(userInfoTable).where(eq(userInfoTable.id, newId)).limit(1);
    currentUser = newUser[0];

    if (env.ADMIN_EMAIL && env.RESEND_API_KEY) {
      try {
        await sendAdminNewUserEmail(env.RESEND_API_KEY, env.ADMIN_EMAIL, env.PORKAST_WEB_BASE_URL, {
          userId: newId,
          email: normalizedEmail,
          nickname: finalNickname,
          regDate: regDateStr,
          source: 'email',
        });
      } catch (err) {
        logger.error(`Failed to send admin notification for new user: ${err}`);
      }
    }
  } else if ((!currentUser.nickname || currentUser.nickname.trim().length === 0) && finalNickname.length > 0) {
    await db
      .update(userInfoTable)
      .set({ nickname: finalNickname, updateDate: now.toISOString() })
      .where(eq(userInfoTable.id, currentUser.id));
    currentUser.nickname = finalNickname;
  }

  if (isDemoEmail(normalizedEmail, env)) {
    const demoTransactionId = `demo-${currentUser.id}`;
    const demoExpires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const existingDemo = await db
      .select()
      .from(userMembership)
      .where(eq(userMembership.originalTransactionId, demoTransactionId))
      .limit(1);

    if (existingDemo.length > 0) {
      await db
        .update(userMembership)
        .set({
          tier: 'unlimited',
          productId: 'podcastsearch.unlimited',
          expiresDate: demoExpires,
          isActive: true,
          willRenew: false,
        })
        .where(eq(userMembership.originalTransactionId, demoTransactionId));
    } else {
      await db.insert(userMembership).values({
        id: randomUUID(),
        userId: currentUser.id,
        productId: 'podcastsearch.unlimited',
        tier: 'unlimited',
        originalTransactionId: demoTransactionId,
        expiresDate: demoExpires,
        isActive: true,
        willRenew: false,
        environment: 'Development',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    }
    logger.info(`Demo user ${normalizedEmail} auto-provisioned unlimited membership`);
  }

  const sessionToken = buildSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(appSession).values({
    id: randomUUID(),
    userId: currentUser.id,
    tokenHash: hashValue(sessionToken),
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  });

  return {
    isNewUser,
    user: mapAuthUser(currentUser),
    session: {
      token: sessionToken,
      expiresAt,
    },
  };
}

export async function getSessionUser(env: Env, token: string): Promise<AuthUser | null> {
  const db = createDb(env.DB);
  const tokenHash = hashValue(token);
  const now = new Date().toISOString();

  const session = await db
    .select()
    .from(appSession)
    .where(
      and(
        eq(appSession.tokenHash, tokenHash),
        isNull(appSession.revokedAt),
        gt(appSession.expiresAt, now),
      )
    )
    .limit(1);

  if (session.length === 0) {
    return null;
  }

  const userRecords = await db
    .select()
    .from(userInfoTable)
    .where(eq(userInfoTable.id, session[0].userId))
    .limit(1);

  if (userRecords.length === 0) {
    logger.warn(`No user found for session ${session[0].id}`);
    return null;
  }

  return mapAuthUser(userRecords[0]);
}

export async function revokeSession(env: Env, token: string): Promise<void> {
  const db = createDb(env.DB);
  const tokenHash = hashValue(token);

  await db
    .update(appSession)
    .set({ revokedAt: new Date().toISOString() })
    .where(
      and(
        eq(appSession.tokenHash, tokenHash),
        isNull(appSession.revokedAt),
      )
    );
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

function mapAuthUser(user: {
  id: string;
  telegramId: string | null;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  avatar: string | null;
}): AuthUser {
  return {
    userId: user.id,
    telegramId: user.telegramId || '',
    nickname: user.nickname || '',
    email: user.email || '',
    phone: user.phone || '',
    avatar: user.avatar || '',
  };
}
