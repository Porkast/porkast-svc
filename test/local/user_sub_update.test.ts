import { updateUserSubscription } from "../../lib/jobs/user_sub_update";

async function runLocalTest() {
    try {
        console.log("Starting user subscription update test...");
        await updateUserSubscription();
        console.log("User subscription update completed successfully");
    } catch (error) {
        console.error("Error running user subscription update:", error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

runLocalTest();
