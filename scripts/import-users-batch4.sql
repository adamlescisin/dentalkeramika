-- User import batch 4/4 (entries 19–22)

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('zarubova.petra@email.cz', 'zarubova.petra', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '6569064'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('zemlickovav@email.cz', 'zemlickovav', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '3473490'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('zubni.prerovnl@seznam.cz', 'zubni.prerovnl', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '71217291'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('zubysestajovice@seznam.cz', 'zubysestajovice', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '3223558'
ON CONFLICT (account_id, user_id) DO NOTHING;
