import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { SubscriptionJobsService } from "./subscription.jobs.service";
import { DbModule } from "../db/db.module";


@Module({
    imports: [DbModule, EmailModule],
    providers: [SubscriptionJobsService],
    exports: [SubscriptionJobsService]
})
export class JobsModule { }