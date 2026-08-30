CREATE TABLE `share_code` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`user_id` text NOT NULL,
	`feed_type` text NOT NULL,
	`feed_ref` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_code_code_unique` ON `share_code` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `share_code_user_feed_unique` ON `share_code` (`user_id`,`feed_type`,`feed_ref`);