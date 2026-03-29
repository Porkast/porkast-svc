const prismaMock = {
  verification_token: {
    deleteMany: mock(),
    create: mock(),
    findFirst: mock(),
  },
  user_info: {
    findFirst: mock(),
    create: mock(),
    update: mock(),
  },
  app_session: {
    create: mock(),
    findFirst: mock(),
    updateMany: mock(),
  },
};

const sendLoginOtpEmailMock = mock();

mock.module('../../db/prisma.client', () => ({
  default: prismaMock,
}));

mock.module('../../email/resend', () => ({
  sendLoginOtpEmail: sendLoginOtpEmailMock,
}));

import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { createEmailOtpChallenge, getBearerToken, getSessionUser, hashValue, normalizeEmail, revokeSession, verifyEmailOtp } from './auth';

describe('auth helpers', () => {
  beforeEach(() => {
    prismaMock.verification_token.deleteMany.mockReset();
    prismaMock.verification_token.create.mockReset();
    prismaMock.verification_token.findFirst.mockReset();
    prismaMock.user_info.findFirst.mockReset();
    prismaMock.user_info.create.mockReset();
    prismaMock.user_info.update.mockReset();
    prismaMock.app_session.create.mockReset();
    prismaMock.app_session.findFirst.mockReset();
    prismaMock.app_session.updateMany.mockReset();
    sendLoginOtpEmailMock.mockReset();
  });

  it('normalizes email and parses bearer token', () => {
    expect(normalizeEmail('  USER@Example.com ')).toBe('user@example.com');
    expect(getBearerToken('Bearer abc123')).toBe('abc123');
    expect(getBearerToken('raw-token')).toBe('raw-token');
    expect(getBearerToken(undefined)).toBeNull();
  });

  it('creates an email otp challenge', async () => {
    prismaMock.verification_token.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.verification_token.create.mockResolvedValue({ id: 'vt_1' });
    sendLoginOtpEmailMock.mockResolvedValue({ id: 'email_1' });

    const result = await createEmailOtpChallenge('Test@Example.com');

    expect(prismaMock.verification_token.deleteMany).toHaveBeenCalledWith({
      where: {
        email: 'test@example.com',
      },
    });
    expect(prismaMock.verification_token.create).toHaveBeenCalled();
    expect(sendLoginOtpEmailMock).toHaveBeenCalled();
    expect(result.expiresIn).toBe(600);
  });

  it('verifies otp for existing user and creates a session', async () => {
    prismaMock.verification_token.findFirst.mockResolvedValue({ id: 'vt_1' });
    prismaMock.verification_token.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.user_info.findFirst.mockResolvedValue({
      id: 'user_1',
      telegram_id: null,
      nickname: 'Listener',
      email: 'listener@example.com',
      phone: null,
      avatar: null,
    });
    prismaMock.app_session.create.mockResolvedValue({ id: 'session_1' });

    const result = await verifyEmailOtp('listener@example.com', '123456');

    expect(result.isNewUser).toBeFalse();
    expect(result.user.userId).toBe('user_1');
    expect(result.session.token.length).toBeGreaterThan(10);
    expect(prismaMock.app_session.create).toHaveBeenCalled();
  });

  it('creates a user when otp is verified for a new email', async () => {
    prismaMock.verification_token.findFirst.mockResolvedValue({ id: 'vt_1' });
    prismaMock.verification_token.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.user_info.findFirst.mockResolvedValue(null);
    prismaMock.user_info.create.mockResolvedValue({
      id: 'user_new',
      telegram_id: null,
      nickname: 'newbie',
      email: 'newbie@example.com',
      phone: null,
      avatar: null,
    });
    prismaMock.app_session.create.mockResolvedValue({ id: 'session_1' });

    const result = await verifyEmailOtp('newbie@example.com', '123456', 'newbie');

    expect(result.isNewUser).toBeTrue();
    expect(prismaMock.user_info.create).toHaveBeenCalled();
    expect(result.user.email).toBe('newbie@example.com');
  });

  it('returns the current session user', async () => {
    const rawToken = 'token-value';
    prismaMock.app_session.findFirst.mockResolvedValue({
      id: 'session_1',
      user_id: 'user_1',
    });
    prismaMock.user_info.findFirst.mockResolvedValue({
      id: 'user_1',
      telegram_id: '',
      nickname: 'Listener',
      email: 'listener@example.com',
      phone: '',
      avatar: '',
    });

    const user = await getSessionUser(rawToken);

    expect(prismaMock.app_session.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        token_hash: hashValue(rawToken),
      }),
    });
    expect(user?.userId).toBe('user_1');
  });

  it('revokes a session', async () => {
    prismaMock.app_session.updateMany.mockResolvedValue({ count: 1 });

    await revokeSession('token-value');

    expect(prismaMock.app_session.updateMany).toHaveBeenCalledWith({
      where: {
        token_hash: hashValue('token-value'),
        revoked_at: null,
      },
      data: {
        revoked_at: expect.any(Date),
      },
    });
  });
});
