import { processUpdate } from "./bot.handler";
import { BOT_TOKEN } from "./bot.setup";

let offset = 0;

async function deleteWebhook() {
    console.log('Deleting existing webhook...');
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
        const data = await response.json();
        if (data.ok && data.result) {
            console.log('Webhook deleted successfully.');
        } else {
            console.warn('Could not delete webhook (this is often not a problem): ', data.description);
        }
    }
 catch (error) {
        console.error('Error deleting webhook:', error);
    }
}

async function getUpdates() {
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=10`);
        const data = await response.json();

        if (data.ok) {
            for (const update of data.result) {
                offset = update.update_id + 1;
                await processUpdate(update);
            }
        } else {
            if (data.description && data.description.includes('terminated by other getUpdates request')) {
                console.warn('Polling conflict during hot reload. The bot will recover automatically.');
            } else {
                console.error('Error getting updates:', data.description);
            }
        }
    }
 catch (error) {
        console.error('Error in polling:', error);
    }
}

export async function startPolling() {
    await deleteWebhook();
    console.log('Starting bot in polling mode...');
    
    while (true) {
        await getUpdates();
    }
}

