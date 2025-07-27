import Baker from 'cronbake';
import { updateUserSubscription } from './user_sub_update';

export function IniteBakerJobs() {
    const baker = Baker.create()
    // Run user subscription job every hour
    console.log('Add user subscription job');
    baker.add({
        name: 'user-sub-update',
        cron: "0 0 * * * *",
        callback: async () => {
            console.log('Start run user subscription job update');
            await updateUserSubscription();
        }
    })
    baker.bakeAll()
}
