import { Resend } from "resend";
import { NotificationParams } from "../models/subscription";
import { readFileSync } from 'fs';
import path from "path";
import * as Hogan from 'hogan.js';

var resendInstance: Resend

export function getResendInstance() {
    if (resendInstance) {
        return resendInstance
    }
    return new Resend(process.env.RESEND_API_KEY)
}

export async function sendSubscriptionUpdateEmail(params: NotificationParams) {
    const resend = getResendInstance();
    const htmlTempText = generateEmailHtmlText(params)
    await resend.emails.send({
        from: 'Porkast <noreply@porkast.com>',
        to: [params.to],
        subject: params.subject,
        html: htmlTempText
    });
}

function generateEmailHtmlText(params: NotificationParams) {
    const htmlTemplatePath = path.join(__dirname, '../resources/porkast-notification.html');
    const htmlTemplate = readFileSync(htmlTemplatePath, 'utf8');
    const htmlTempText = Hogan.compile(htmlTemplate).render({
        keyword: params.keyword,
        nickname: params.nickname,
        updateCount: params.updateCount,
        titleList: params.titleList,
        link: params.link
    })
    return htmlTempText
}