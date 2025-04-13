import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { SubscriptionJobsService } from "./subscription.jobs.service";
import { DbModule } from "../db/db.module";
import { TeleBotModule } from "src/telegram/bot.module";


@Module({
    imports: [DbModule, EmailModule, TeleBotModule],
    providers: [SubscriptionJobsService],
    exports: [SubscriptionJobsService]
})
export class JobsModule { }