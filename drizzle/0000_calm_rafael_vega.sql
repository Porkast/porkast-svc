CREATE TABLE `app_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_session_token_hash_unique` ON `app_session` (`token_hash`);--> statement-breakpoint
CREATE INDEX `app_session_user_id_idx` ON `app_session` (`user_id`);--> statement-breakpoint
CREATE INDEX `app_session_expires_at_idx` ON `app_session` (`expires_at`);--> statement-breakpoint
CREATE TABLE `feed_channel` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`channel_desc` text,
	`image_url` text,
	`link` text,
	`feed_link` text,
	`copyright` text,
	`language` text,
	`author` text,
	`owner_name` text,
	`owner_email` text,
	`feed_type` text,
	`categories` text,
	`source` text,
	`feed_id` text
);
--> statement-breakpoint
CREATE TABLE `feed_item` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`guid` text,
	`title` text,
	`link` text,
	`pub_date` text,
	`author` text,
	`input_date` text,
	`image_url` text,
	`enclosure_url` text,
	`enclosure_type` text,
	`enclosure_length` text,
	`duration` text,
	`episode` text,
	`explicit` text,
	`season` text,
	`episodetype` text,
	`description` blob,
	`channel_title` text,
	`feed_id` text NOT NULL,
	`feed_link` text,
	`source` text
);
--> statement-breakpoint
CREATE INDEX `rfi_idx_channel_id` ON `feed_item` (`channel_id`);--> statement-breakpoint
CREATE INDEX `rfi_idx_pub_date` ON `feed_item` (`pub_date`);--> statement-breakpoint
CREATE TABLE `keyword_subscription` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyword` text NOT NULL,
	`feed_channel_id` text NOT NULL,
	`feed_item_id` text NOT NULL,
	`create_time` text,
	`country` text,
	`source` text,
	`exclude_feed_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ks_idx_uniq` ON `keyword_subscription` (`keyword`,`feed_channel_id`,`feed_item_id`,`country`,`source`,`exclude_feed_id`);--> statement-breakpoint
CREATE INDEX `ks_idx_kcse` ON `keyword_subscription` (`keyword`,`country`,`source`,`exclude_feed_id`);--> statement-breakpoint
CREATE INDEX `ks_idx_keyword` ON `keyword_subscription` (`keyword`);--> statement-breakpoint
CREATE TABLE `user_info` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text,
	`nickname` text,
	`password` text,
	`email` text,
	`phone` text,
	`reg_date` text,
	`update_date` text,
	`avatar` text,
	`telegram_id` text
);
--> statement-breakpoint
CREATE TABLE `user_listen_later` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`item_id` text,
	`channel_id` text,
	`reg_date` text,
	`status` integer DEFAULT 1
);
--> statement-breakpoint
CREATE INDEX `ull_idx_item_id` ON `user_listen_later` (`item_id`);--> statement-breakpoint
CREATE INDEX `ull_idx_user_id` ON `user_listen_later` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_membership` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`tier` text NOT NULL,
	`original_transaction_id` text NOT NULL,
	`latest_transaction_id` text,
	`expires_date` text,
	`is_active` integer DEFAULT false,
	`will_renew` integer DEFAULT true,
	`is_in_billing_retry` integer DEFAULT false,
	`environment` text DEFAULT 'Production',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_membership_original_transaction_id_unique` ON `user_membership` (`original_transaction_id`);--> statement-breakpoint
CREATE INDEX `user_membership_user_id_idx` ON `user_membership` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_playlist` (
	`id` text PRIMARY KEY NOT NULL,
	`playlist_name` text,
	`description` blob,
	`user_id` text,
	`reg_date` text,
	`status` integer DEFAULT 1,
	`creator_id` text,
	`orig_playlist_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `up_idx_uid_name` ON `user_playlist` (`user_id`,`playlist_name`);--> statement-breakpoint
CREATE INDEX `up_idx_user_id` ON `user_playlist` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_playlist_item` (
	`id` text PRIMARY KEY NOT NULL,
	`playlist_id` text NOT NULL,
	`item_id` text NOT NULL,
	`channel_id` text,
	`reg_date` text,
	`status` integer DEFAULT 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX `upi_idx_playlist_id` ON `user_playlist_item` (`playlist_id`);--> statement-breakpoint
CREATE TABLE `user_subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`create_time` text,
	`status` integer DEFAULT 1,
	`keyword` text,
	`order_by_date` integer,
	`lang` text,
	`country` text,
	`exclude_feed_id` text,
	`source` text,
	`ref_id` text,
	`ref_name` text,
	`type` text DEFAULT 'searchKeyword',
	`latest_id` integer DEFAULT 0,
	`update_time` text,
	`total_count` integer DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX `usk_idx_keyword` ON `user_subscription` (`keyword`);--> statement-breakpoint
CREATE INDEX `usk_idx_user_id` ON `user_subscription` (`user_id`);--> statement-breakpoint
CREATE INDEX `usk_user_id_keyword` ON `user_subscription` (`user_id`,`keyword`,`source`);--> statement-breakpoint
CREATE TABLE `verification_token` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verification_token_email_token_unique` ON `verification_token` (`email`,`token`);