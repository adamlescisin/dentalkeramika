-- User import batch 2/4 (entries 7–12)

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('info@estetika-novotna.cz', 'info', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '75090759'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('jozef.harvis@gmail.com', 'jozef.harvis', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '29541981'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('kladnyzubar@gmail.com', 'kladnyzubar', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '7615299'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('kozel-olga@seznam.cz', 'kozel-olga', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '9204288'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('michaelaseplava@seznam.cz', 'michaelaseplava', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '86690566'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('panikova@dentikoberoun.cz', 'panikova', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '5734185'
ON CONFLICT (account_id, user_id) DO NOTHING;
