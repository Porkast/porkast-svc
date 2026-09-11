-- Remove prohibited (adult/explicit) content from stored data to comply with the
-- Content Policy and payment provider requirements.
-- Apply:
--   local:  wrangler d1 execute porkast-db --local --file=drizzle/0006_remove_prohibited_content.sql
--   remote: wrangler d1 execute porkast-db --remote --file=drizzle/0006_remove_prohibited_content.sql

DELETE FROM keyword_subscription WHERE feed_item_id IN (
  SELECT id FROM feed_item WHERE
    lower(explicit) IN ('yes', 'true', '1', 'explicit')
    OR lower(title) LIKE '%porn%' OR lower(title) LIKE '%xxx%' OR lower(title) LIKE '%nsfw%'
    OR lower(title) LIKE '%hentai%' OR lower(title) LIKE '%onlyfans%' OR lower(title) LIKE '%erotic%'
    OR lower(title) LIKE '%fetish%' OR lower(title) LIKE '%bdsm%' OR lower(title) LIKE '%camgirl%'
    OR lower(title) LIKE '%milf%' OR lower(title) LIKE '%blowjob%' OR lower(title) LIKE '%gangbang%'
    OR lower(title) LIKE '%creampie%' OR lower(title) LIKE '%bukkake%' OR lower(title) LIKE '%orgy%'
    OR lower(title) LIKE '%dildo%' OR lower(title) LIKE '%vibrator%' OR lower(title) LIKE '%masturbat%'
    OR lower(title) LIKE '%sexting%' OR lower(title) LIKE '%stripper%' OR lower(title) LIKE '%escort service%'
    OR lower(title) LIKE '%adult film%' OR lower(title) LIKE '%adult video%'
    OR lower(channel_title) LIKE '%porn%' OR lower(channel_title) LIKE '%nsfw%' OR lower(channel_title) LIKE '%hentai%'
    OR title LIKE '%色情%' OR title LIKE '%情色%' OR title LIKE '%裸照%' OR title LIKE '%裸聊%'
    OR title LIKE '%约炮%' OR title LIKE '%性爱%' OR title LIKE '%做爱%' OR title LIKE '%黄片%'
    OR title LIKE '%三级片%' OR title LIKE '%里番%' OR title LIKE '%卖淫%' OR title LIKE '%嫖娼%'
    OR title LIKE '%成人视频%' OR title LIKE '%成人影片%' OR title LIKE '%成人内容%' OR title LIKE '%福利姬%'
);--> statement-breakpoint

DELETE FROM user_listen_later WHERE item_id IN (
  SELECT id FROM feed_item WHERE
    lower(explicit) IN ('yes', 'true', '1', 'explicit')
    OR lower(title) LIKE '%porn%' OR lower(title) LIKE '%xxx%' OR lower(title) LIKE '%nsfw%'
    OR lower(title) LIKE '%hentai%' OR lower(title) LIKE '%onlyfans%' OR lower(title) LIKE '%erotic%'
    OR lower(title) LIKE '%fetish%' OR lower(title) LIKE '%bdsm%' OR lower(title) LIKE '%camgirl%'
    OR lower(title) LIKE '%milf%' OR lower(title) LIKE '%blowjob%' OR lower(title) LIKE '%gangbang%'
    OR lower(title) LIKE '%creampie%' OR lower(title) LIKE '%bukkake%' OR lower(title) LIKE '%orgy%'
    OR lower(title) LIKE '%dildo%' OR lower(title) LIKE '%vibrator%' OR lower(title) LIKE '%masturbat%'
    OR lower(title) LIKE '%sexting%' OR lower(title) LIKE '%stripper%' OR lower(title) LIKE '%escort service%'
    OR lower(title) LIKE '%adult film%' OR lower(title) LIKE '%adult video%'
    OR lower(channel_title) LIKE '%porn%' OR lower(channel_title) LIKE '%nsfw%' OR lower(channel_title) LIKE '%hentai%'
    OR title LIKE '%色情%' OR title LIKE '%情色%' OR title LIKE '%裸照%' OR title LIKE '%裸聊%'
    OR title LIKE '%约炮%' OR title LIKE '%性爱%' OR title LIKE '%做爱%' OR title LIKE '%黄片%'
    OR title LIKE '%三级片%' OR title LIKE '%里番%' OR title LIKE '%卖淫%' OR title LIKE '%嫖娼%'
    OR title LIKE '%成人视频%' OR title LIKE '%成人影片%' OR title LIKE '%成人内容%' OR title LIKE '%福利姬%'
);--> statement-breakpoint

DELETE FROM user_playlist_item WHERE item_id IN (
  SELECT id FROM feed_item WHERE
    lower(explicit) IN ('yes', 'true', '1', 'explicit')
    OR lower(title) LIKE '%porn%' OR lower(title) LIKE '%xxx%' OR lower(title) LIKE '%nsfw%'
    OR lower(title) LIKE '%hentai%' OR lower(title) LIKE '%onlyfans%' OR lower(title) LIKE '%erotic%'
    OR lower(title) LIKE '%fetish%' OR lower(title) LIKE '%bdsm%' OR lower(title) LIKE '%camgirl%'
    OR lower(title) LIKE '%milf%' OR lower(title) LIKE '%blowjob%' OR lower(title) LIKE '%gangbang%'
    OR lower(title) LIKE '%creampie%' OR lower(title) LIKE '%bukkake%' OR lower(title) LIKE '%orgy%'
    OR lower(title) LIKE '%dildo%' OR lower(title) LIKE '%vibrator%' OR lower(title) LIKE '%masturbat%'
    OR lower(title) LIKE '%sexting%' OR lower(title) LIKE '%stripper%' OR lower(title) LIKE '%escort service%'
    OR lower(title) LIKE '%adult film%' OR lower(title) LIKE '%adult video%'
    OR lower(channel_title) LIKE '%porn%' OR lower(channel_title) LIKE '%nsfw%' OR lower(channel_title) LIKE '%hentai%'
    OR title LIKE '%色情%' OR title LIKE '%情色%' OR title LIKE '%裸照%' OR title LIKE '%裸聊%'
    OR title LIKE '%约炮%' OR title LIKE '%性爱%' OR title LIKE '%做爱%' OR title LIKE '%黄片%'
    OR title LIKE '%三级片%' OR title LIKE '%里番%' OR title LIKE '%卖淫%' OR title LIKE '%嫖娼%'
    OR title LIKE '%成人视频%' OR title LIKE '%成人影片%' OR title LIKE '%成人内容%' OR title LIKE '%福利姬%'
);--> statement-breakpoint

DELETE FROM user_listen_history WHERE item_id IN (
  SELECT id FROM feed_item WHERE
    lower(explicit) IN ('yes', 'true', '1', 'explicit')
    OR lower(title) LIKE '%porn%' OR lower(title) LIKE '%xxx%' OR lower(title) LIKE '%nsfw%'
    OR lower(title) LIKE '%hentai%' OR lower(title) LIKE '%onlyfans%' OR lower(title) LIKE '%erotic%'
    OR lower(title) LIKE '%fetish%' OR lower(title) LIKE '%bdsm%' OR lower(title) LIKE '%camgirl%'
    OR lower(title) LIKE '%milf%' OR lower(title) LIKE '%blowjob%' OR lower(title) LIKE '%gangbang%'
    OR lower(title) LIKE '%creampie%' OR lower(title) LIKE '%bukkake%' OR lower(title) LIKE '%orgy%'
    OR lower(title) LIKE '%dildo%' OR lower(title) LIKE '%vibrator%' OR lower(title) LIKE '%masturbat%'
    OR lower(title) LIKE '%sexting%' OR lower(title) LIKE '%stripper%' OR lower(title) LIKE '%escort service%'
    OR lower(title) LIKE '%adult film%' OR lower(title) LIKE '%adult video%'
    OR lower(channel_title) LIKE '%porn%' OR lower(channel_title) LIKE '%nsfw%' OR lower(channel_title) LIKE '%hentai%'
    OR title LIKE '%色情%' OR title LIKE '%情色%' OR title LIKE '%裸照%' OR title LIKE '%裸聊%'
    OR title LIKE '%约炮%' OR title LIKE '%性爱%' OR title LIKE '%做爱%' OR title LIKE '%黄片%'
    OR title LIKE '%三级片%' OR title LIKE '%里番%' OR title LIKE '%卖淫%' OR title LIKE '%嫖娼%'
    OR title LIKE '%成人视频%' OR title LIKE '%成人影片%' OR title LIKE '%成人内容%' OR title LIKE '%福利姬%'
);--> statement-breakpoint

DELETE FROM feed_item WHERE
  lower(explicit) IN ('yes', 'true', '1', 'explicit')
  OR lower(title) LIKE '%porn%' OR lower(title) LIKE '%xxx%' OR lower(title) LIKE '%nsfw%'
  OR lower(title) LIKE '%hentai%' OR lower(title) LIKE '%onlyfans%' OR lower(title) LIKE '%erotic%'
  OR lower(title) LIKE '%fetish%' OR lower(title) LIKE '%bdsm%' OR lower(title) LIKE '%camgirl%'
  OR lower(title) LIKE '%milf%' OR lower(title) LIKE '%blowjob%' OR lower(title) LIKE '%gangbang%'
  OR lower(title) LIKE '%creampie%' OR lower(title) LIKE '%bukkake%' OR lower(title) LIKE '%orgy%'
  OR lower(title) LIKE '%dildo%' OR lower(title) LIKE '%vibrator%' OR lower(title) LIKE '%masturbat%'
  OR lower(title) LIKE '%sexting%' OR lower(title) LIKE '%stripper%' OR lower(title) LIKE '%escort service%'
  OR lower(title) LIKE '%adult film%' OR lower(title) LIKE '%adult video%'
  OR lower(channel_title) LIKE '%porn%' OR lower(channel_title) LIKE '%nsfw%' OR lower(channel_title) LIKE '%hentai%'
  OR title LIKE '%色情%' OR title LIKE '%情色%' OR title LIKE '%裸照%' OR title LIKE '%裸聊%'
  OR title LIKE '%约炮%' OR title LIKE '%性爱%' OR title LIKE '%做爱%' OR title LIKE '%黄片%'
  OR title LIKE '%三级片%' OR title LIKE '%里番%' OR title LIKE '%卖淫%' OR title LIKE '%嫖娼%'
  OR title LIKE '%成人视频%' OR title LIKE '%成人影片%' OR title LIKE '%成人内容%' OR title LIKE '%福利姬%';
