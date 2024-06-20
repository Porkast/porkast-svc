import * as path from 'path'; 
import { NotificationParams } from "../models/subscription";
import { EmailServiceResend } from "./email.service.resend";
import { Injectable } from "@nestjs/common";
import { readFileSync } from "fs";
import * as Hogan from 'hogan.js';


@Injectable()
export class EmailService {

    constructor(
        private readonly resendClient: EmailServiceResend
    ) { }

    async sendSubscriptionUpdateEmail(params: NotificationParams) {
        const resend = this.resendClient.getResendClient();
        const htmlTempText = this.generateEmailHtmlText(params)
        await resend.emails.send({
            from: 'Porkast <noreply@porkast.com>',
            to: [params.to],
            subject: params.subject,
            html: htmlTempText
        });
    }

    generateEmailHtmlText(params: NotificationParams) {
        const htmlTemplatePath = path.join(process.cwd(), `./resources/porkast-notification.html`);
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
}