import { Start, Update } from "nestjs-telegraf";
import { DBService } from "src/db/db.service";
import { TeleBotService } from "src/telegram/bot.service";


@Update()
export class TeleBotUpdate {

    constructor(
        private readonly botService: TeleBotService,
        private readonly dbService: DBService
    ) {
    }

    @Start()
    async onStart(): Promise<String> {
        const botInfo = await this.botService.getBotInfo();
        return `Hi, I'm ${botInfo.username}, this is Porkast bot.`
    }
}