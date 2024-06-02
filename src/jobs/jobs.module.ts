import { Module } from "@nestjs/common";
import { EmailModule } from "src/email/email.module";


@Module({
    imports: [DbModule, EmailModule],
})
export class DbModule { }