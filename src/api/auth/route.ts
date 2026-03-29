import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { createEmailOtpChallenge, getBearerToken, getSessionUser, revokeSession, verifyEmailOtp } from './auth';
import { EmailOtpRequestSchema, EmailOtpVerifySchema, type EmailOtpRequestData, type EmailOtpVerifyData } from './types';

export const authRouter = new Hono();

authRouter.post('/email-otp/request', zValidator('json', EmailOtpRequestSchema), async (c) => {
  const body: EmailOtpRequestData = await c.req.json();
  const data = await createEmailOtpChallenge(body.email);

  return c.json({
    code: 0,
    msg: 'If the email is eligible, an OTP has been sent',
    data,
  });
});

authRouter.post('/email-otp/verify', zValidator('json', EmailOtpVerifySchema), async (c) => {
  const body: EmailOtpVerifyData = await c.req.json();

  try {
    const data = await verifyEmailOtp(body.email, body.code, body.nickname);
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

  const user = await getSessionUser(token);
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

  await revokeSession(token);

  return c.json({
    code: 0,
    msg: 'Signed out',
  });
});
