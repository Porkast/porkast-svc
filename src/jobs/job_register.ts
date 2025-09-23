import Baker from 'cronbake';
import { updateUserSubscription } from './user_sub_update';
import { logger } from '../utils/logger';

export function IniteBakerJobs() {
    const baker = Baker.create()
    // Run user subscription job every hour
    logger.info('Add user subscription job');
    baker.add({
        name: 'user-sub-update',
        cron: "0 0 * * * *",
        callback: async () => {
            logger.info('Start run user subscription job update');
            await updateUserSubscription();
        }
    })
    baker.bakeAll()
}
