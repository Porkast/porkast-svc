import { Module } from "@nestjs/common";
import { DbModule } from "src/db/db.module";
import { TeleBotService } from "src/telegram/bot.service";

@Module({
    providers: [TeleBotService],
    imports: [
        DbModule
    ],
    exports: [TeleBotService]
})
export class TeleBotModule { }