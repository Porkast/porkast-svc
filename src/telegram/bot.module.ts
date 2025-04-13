import { Module } from "@nestjs/common";
import { TelegrafModule } from "nestjs-telegraf";
import { DbModule } from "src/db/db.module";
import { TeleBotService } from "src/telegram/bot.service";
import { TeleBotUpdate } from "src/telegram/bot.update";

@Module({
    providers: [TeleBotUpdate, TeleBotService],
    imports: [
        TelegrafModule.forRoot({
            token: process.env.TELE_BOT_TOKEN,
        }),
        DbModule
    ],
    exports: [TeleBotService]
})
export class TeleBotModule { }