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
    const htmlTempText = await generateEmailHtmlText(params)
    const resendResult = await resend.emails.send({
        from: 'Porkast <noreply@porkast.com>',
        to: [params.to],
        subject: params.subject,
        html: htmlTempText
    });
    return resendResult
}

async function generateEmailHtmlText(params: NotificationParams) {
    const htmlTemplate = await Bun.file("./resources/porkast-notification.html").text();
    const htmlTempText = Hogan.compile(htmlTemplate).render({
        keyword: params.keyword,
        nickname: params.nickname,
        updateCount: params.updateCount,
        titleList: params.titleList,
        link: params.link
    })
    return htmlTempText
}