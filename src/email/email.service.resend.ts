import { Injectable } from "@nestjs/common";
import { Resend } from "resend";


@Injectable()
export class EmailServiceResend {

    private resendClient: Resend;

    getResendClient() {
        if (!this.resendClient) {
            this.resendClient = new Resend(process.env.RESEND_API_KEY);
        }
        return this.resendClient;
    }
}