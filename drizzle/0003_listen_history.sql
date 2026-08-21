CREATE TABLE `user_listen_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`item_id` text NOT NULL,
	`channel_id` text,
	`duration` text,
	`position` integer DEFAULT 0,
	`status` integer DEFAULT 1,
	`reg_date` text,
	`update_date` text,
	`source` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ulh_idx_uid_item` ON `user_listen_history` (`user_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `ulh_idx_user_id` ON `user_listen_history` (`user_id`);--> statement-breakpoint
CREATE INDEX `ulh_idx_item_id` ON `user_listen_history` (`item_id`);
