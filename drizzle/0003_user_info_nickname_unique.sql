-- user_info.nickname is now the user-friendly public identifier used in share links.
-- Nicknames are normalized to lowercase, only [a-zA-Z0-9_-] allowed, and must be globally unique.
-- Apply before deploying code that writes normalized nicknames:
--   local:  wrangler d1 execute porkast-db --local --file=drizzle/0003_user_info_nickname_unique.sql
--   remote: wrangler d1 execute porkast-db --remote --file=drizzle/0003_user_info_nickname_unique.sql

-- 1) Trim + lowercase existing nicknames (SQLite LOWER is ASCII-only, safe after step 2)
UPDATE user_info SET nickname = TRIM(LOWER(nickname)) WHERE nickname IS NOT NULL;

-- 2) Empty nicknames/whitespace-only are treated as "no nickname" (falls back to userId in share links)
UPDATE user_info SET nickname = NULL WHERE nickname IS NULL OR TRIM(nickname) = '';

-- 3) Any character outside [a-zA-Z0-9_-] (spaces, unicode, punctuation) invalidates the nickname
UPDATE user_info SET nickname = NULL WHERE nickname IS NOT NULL AND nickname GLOB '*[^a-zA-Z0-9_-]*';

-- 4) Dedupe remaining collisions by appending an id-derived suffix
UPDATE user_info
SET nickname = nickname || '-' || substr(id, 1, 8)
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY nickname ORDER BY id) AS rn
    FROM user_info
    WHERE nickname IS NOT NULL
  )
  WHERE rn > 1
);

-- 5) Rare edge: suffixed nickname still colliding -> drop (falls back to userId)
UPDATE user_info
SET nickname = NULL
WHERE nickname IS NOT NULL AND id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY nickname ORDER BY id) AS rn
    FROM user_info
    WHERE nickname IS NOT NULL
  )
  WHERE rn > 1
);

-- 6) Uniqueness guarantee
CREATE UNIQUE INDEX `user_info_nickname_unique` ON `user_info` (`nickname`);
