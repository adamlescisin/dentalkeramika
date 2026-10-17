-- User import batch 1/4 (entries 1–6)
-- Pattern: create user if not exists, link to account by ICO as owner.
-- Emails lowercased. first_name = email prefix, last_name = '-' (update later).

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('albertsedlacek@gmail.com', 'albertsedlacek', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '19869169'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('bohmova@dentikoberoun.cz', 'bohmova', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '5734185'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('dentartvinor@seznam.cz', 'dentartvinor', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '26754916'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('dentiko@email.cz', 'dentiko', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '5734185'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('info@delosdental.cz', 'info', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '21256080'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('info@easydent.cz', 'info', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '29263832'
ON CONFLICT (account_id, user_id) DO NOTHING;
