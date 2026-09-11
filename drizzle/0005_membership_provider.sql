-- Add payment provider tracking to user_membership so Dodo Payments (web)
-- subscriptions can coexist with Apple App Store (iOS) memberships.
-- Apply before deploying the Dodo integration:
--   local:  wrangler d1 execute porkast-db --local --file=drizzle/0005_membership_provider.sql
--   remote: wrangler d1 execute porkast-db --remote --file=drizzle/0005_membership_provider.sql

ALTER TABLE `user_membership` ADD `provider` text DEFAULT 'appstore' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_membership` ADD `provider_customer_id` text;
