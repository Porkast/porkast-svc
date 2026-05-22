import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { createEmailOtpChallenge, getBearerToken, getSessionUser, revokeSession, verifyEmailOtp } from './auth';
import { EmailOtpRequestSchema, EmailOtpVerifySchema, type EmailOtpRequestData, type EmailOtpVerifyData } from './types';
import type { Env } from '../../env';

export const authRouter = new Hono<{ Bindings: Env }>();

authRouter.post('/email-otp/request', zValidator('json', EmailOtpRequestSchema), async (c) => {
  const body: EmailOtpRequestData = await c.req.json();

  try {
    const data = await createEmailOtpChallenge(c.env, body.email);
    return c.json({
      code: 0,
      msg: 'If the email is eligible, an OTP has been sent',
      data,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    if (msg.startsWith('Resend too soon:')) {
      const retryAfter = parseInt(msg.split(':')[1].trim());
      return c.json({
        code: 1,
        msg: `Please wait ${retryAfter} seconds and try again.`,
        error: 'RATE_LIMITED',
        retryAfter,
      }, 429);
    }
    return c.json({
      code: 1,
      msg: msg || 'Failed to send verification code',
    }, 500);
  }
});

authRouter.post('/email-otp/verify', zValidator('json', EmailOtpVerifySchema), async (c) => {
  const body: EmailOtpVerifyData = await c.req.json();

  try {
    const data = await verifyEmailOtp(c.env, body.email, body.code, body.nickname);
    return c.json({
      code: 0,
      msg: 'Success',
      data,
    });
  } catch (error) {
    return c.json({
      code: 1,
      msg: error instanceof Error ? error.message : 'Failed to verify code',
    }, 401);
  }
});

authRouter.get('/session', async (c) => {
  const token = getBearerToken(c.req.header('Authorization'));
  if (!token) {
    return c.json({
      code: 1,
      msg: 'Unauthorized',
    }, 401);
  }

  const user = await getSessionUser(c.env, token);
  if (!user) {
    return c.json({
      code: 1,
      msg: 'Session not found',
    }, 401);
  }

  return c.json({
    code: 0,
    msg: 'Success',
    data: {
      user,
    },
  });
});

authRouter.delete('/session', async (c) => {
  const token = getBearerToken(c.req.header('Authorization'));
  if (!token) {
    return c.json({
      code: 1,
      msg: 'Unauthorized',
    }, 401);
  }

  await revokeSession(c.env, token);

  return c.json({
    code: 0,
    msg: 'Signed out',
  });
});
