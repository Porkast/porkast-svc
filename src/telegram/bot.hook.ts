import { Hono } from 'hono';
import { processUpdate } from './bot.handler';
import { logger } from '../utils/logger';

const teleBot = new Hono();

teleBot.post('/bot-webhook', async (c) => {
    try {
        const update = await c.req.json();
        console.debug('received update:', JSON.stringify(update, null, 2));
        await processUpdate(update);
        return c.json({ ok: true });
    } catch (error) {
        logger.error('Error processing update:', error);
        return c.json({ ok: false, error: 'Internal Server Error' }, 200);
    }
});

export default teleBot;
