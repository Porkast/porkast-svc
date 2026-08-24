-- Restore the Chinese (unicode) nickname on the Telegram account.
-- Unicode nicknames are now valid public share identifiers; share/RSS links use percent-encoded UTF-8.
-- Apply:
--   local:  wrangler d1 execute porkast-db --local --file=drizzle/0004_restore_unicode_nickname.sql
--   remote: wrangler d1 execute porkast-db --remote --file=drizzle/0004_restore_unicode_nickname.sql

-- Safety: abort with a unique constraint failure if the nickname would collide
-- (no other row may hold this exact nickname).
UPDATE user_info
SET nickname = '陈俊乾', update_date = datetime('now')
WHERE id = '4962bb3c-1b7b-4154-bcf9-a7ad0f235a13'
  AND NOT EXISTS (
    SELECT 1 FROM user_info u
    WHERE u.nickname = '陈俊乾' AND u.id != '4962bb3c-1b7b-4154-bcf9-a7ad0f235a13'
  );
