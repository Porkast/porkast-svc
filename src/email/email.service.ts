import { NotificationParams } from "../models/subscription";
import { EmailServiceResend } from "./email.service.resend";
import { Injectable } from "@nestjs/common";


@Injectable()
export class EmailService {

    constructor(
        private readonly resendClient: EmailServiceResend
    ) { }

    async sendSubscriptionUpdateEmail(params: NotificationParams) {
        const resend = this.resendClient.getResendClient();
        await resend.emails.send({
            from: 'Porkast <noreply@porkast.com>',
            to: [params.to],
            subject: params.subject,
            html: ""
        });
    }
}