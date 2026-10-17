-- User import batch 3/4 (entries 13–18)

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('pauliskova@dentikoberoun.cz', 'pauliskova', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '5734185'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('petrlikova.l@seznam.cz', 'petrlikova.l', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '6569064'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('rausova.zubni@seznam.cz', 'rausova.zubni', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '1368010'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('recepce.harfa@csdc.cz', 'recepce.harfa', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '5774152'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('renata.siruckova@seznam.cz', 'renata.siruckova', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '2912694'
ON CONFLICT (account_id, user_id) DO NOTHING;

WITH u AS (
  INSERT INTO dk_users (email, first_name, last_name, email_verified_at)
  VALUES ('vaculikova@dentikoberoun.cz', 'vaculikova', '-', NOW())
  ON CONFLICT (email) DO UPDATE SET email_verified_at = COALESCE(dk_users.email_verified_at, NOW())
  RETURNING id
)
INSERT INTO dk_account_users (account_id, user_id, role, status, accepted_at)
SELECT a.id, u.id, 'owner', 'active', NOW() FROM dk_accounts a, u WHERE a.ico = '5734185'
ON CONFLICT (account_id, user_id) DO NOTHING;
