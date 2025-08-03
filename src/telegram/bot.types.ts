
export interface BotCommand {
    command: string;
    description: string;
}

export const BotCommands: BotCommand[] = [
    {
        command: 'start',
        description: 'Welcome to Porkast',
    },
    {
        command: 'help',
        description: 'Get help on how to use the bot',
    },
    {
        command: 'subscribe',
        description: 'View your key word subscription list',
    },
];
