import { Module } from "@nestjs/common";
import { EmailServiceResend } from "./email.service.resend";
import { EmailService } from "./email.service";

@Module({
    providers: [
        EmailServiceResend,
        EmailService,
    ],
    exports: [
        EmailService
    ]
})
export class EmailModule { }