
export interface BotCommand {
    command: string;
    description: string;
}

export const START_COMMAND = '/start';
export const HELP_COMMAND = '/help';
export const SUBSCRIBE_COMMAND = '/subscribe';

export const BotCommandsMap = new Map<string, BotCommand>([
    [START_COMMAND, { command: 'start', description: 'Welcome to Porkast' }],
    [HELP_COMMAND, { command: 'help', description: 'Get help on how to use the bot' }],
    [SUBSCRIBE_COMMAND, { command: 'subscribe', description: 'View your key word subscription list' }],
]);

export const BotCommands: BotCommand[] = Array.from(BotCommandsMap.values());
