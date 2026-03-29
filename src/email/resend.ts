import { CreateEmailResponse, Resend } from "resend";
import { NotificationParams } from "../models/subscription";
import * as Hogan from 'hogan.js';

var resendInstance: Resend

export function getResendInstance() {
    if (resendInstance) {
        return resendInstance
    }
    return new Resend(process.env.RESEND_API_KEY)
}

export async function sendSubscriptionUpdateEmail(params: NotificationParams): Promise<CreateEmailResponse> {
    const resend = getResendInstance();
    const htmlTempText = await generateTemplate("./resources/porkast-notification.html", {
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

export async function sendLoginOtpEmail(to: string, code: string, expiresMinutes: number): Promise<CreateEmailResponse> {
    const resend = getResendInstance();
    const htmlTempText = await generateTemplate("./resources/porkast-login-otp.html", {
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

async function generateTemplate(templatePath: string, params: Record<string, unknown>) {
    const htmlTemplate = await Bun.file(templatePath).text();
    const htmlTempText = Hogan.compile(htmlTemplate).render(params)
    return htmlTempText
}
