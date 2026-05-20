import { CreateEmailResponse, Resend } from "resend";
import { NotificationParams } from "../models/subscription";
import * as Hogan from 'hogan.js';
import { NOTIFICATION_TEMPLATE } from '../templates/notification';
import { LOGIN_OTP_TEMPLATE } from '../templates/login-otp';

var resendInstance: Resend

export function getResendInstance(apiKey: string) {
    if (resendInstance) {
        return resendInstance
    }
    resendInstance = new Resend(apiKey)
    return resendInstance
}

export async function sendSubscriptionUpdateEmail(apiKey: string, params: NotificationParams): Promise<CreateEmailResponse> {
    const resend = getResendInstance(apiKey);
    const htmlTempText = Hogan.compile(NOTIFICATION_TEMPLATE).render({
        keyword: params.keyword,
        nickname: params.nickname,
        updateCount: params.updateCount,
        titleList: params.titleList,
        link: params.link
    })
    const resendResult = await resend.emails.send({
        from: 'Porkast <noreply@porkast.com>',
        to: [params.to],
        subject: params.subject,
        html: htmlTempText
    });
    return resendResult
}

export async function sendLoginOtpEmail(apiKey: string, to: string, code: string, expiresMinutes: number): Promise<CreateEmailResponse> {
    const resend = getResendInstance(apiKey);
    const htmlTempText = Hogan.compile(LOGIN_OTP_TEMPLATE).render({
        code,
        expiresMinutes
    })

    return resend.emails.send({
        from: 'Porkast <noreply@porkast.com>',
        to: [to],
        subject: `${code} is your Porkast sign in code`,
        html: htmlTempText
    });
}
