import { Test } from "@nestjs/testing";
import { SubscriptionJobsService } from "./subscription.jobs.service";
import { JobsModule } from "./jobs.module";


describe('SubscriptionJobsService', () => {

    let subService: SubscriptionJobsService

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [JobsModule],
        }).compile();

        subService = moduleRef.get<SubscriptionJobsService>(SubscriptionJobsService);
    });
    it('should not have exception', async () => {
       await subService.updateUserSubscription()
    }, 100000);
})