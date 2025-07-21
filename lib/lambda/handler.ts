// lib/lambda/handler.ts
import { updateUserSubscription } from '../../jobs/user_sub_update';

export const handler = async (): Promise<void> => {
    console.log('Start user subscription update', new Date().toISOString());

    try {
        await updateUserSubscription();
        console.log('Finish user subscription update', new Date().toISOString());
    } catch (error) {
        console.error('Error in user subscription update', error);
        throw error;
    }
};