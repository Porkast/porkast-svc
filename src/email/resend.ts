import { CreateEmailResponse, Resend } from "resend";
import type { NotificationParams } from "../models/subscription";
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

function renderTemplate(template: string, params: Record<string, any>): string {
    let result = template
    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
            const sectionRegex = new RegExp(`{{#${key}}}([\\s\\S]*?){{\/${key}}}`, 'g')
            result = result.replace(sectionRegex, (_, sectionContent) => {
                return value.map((v: any) => sectionContent.replace(/{{\.}}/g, v)).join('')
            })
        } else {
            const regex = new RegExp(`{{${key}}}`, 'g')
            result = result.replace(regex, String(value ?? ''))
        }
    }
    return result
}

export async function sendSubscriptionUpdateEmail(apiKey: string, params: NotificationParams): Promise<CreateEmailResponse> {
    const resend = getResendInstance(apiKey);
    const htmlTempText = renderTemplate(NOTIFICATION_TEMPLATE, {
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
    const htmlTempText = renderTemplate(LOGIN_OTP_TEMPLATE, { code, expiresMinutes })

    return resend.emails.send({
        from: 'Porkast <noreply@porkast.com>',
        to: [to],
        subject: `${code} is your Porkast sign in code`,
        html: htmlTempText
    });
}
