-- Silent practice import — no users, no emails.
-- Run against the Neon database:
--   psql "$DATABASE_URL_UNPOOLED" -f scripts/import-practices.sql
--
-- Safe to run twice: the WHERE NOT EXISTS guards skip any practice
-- whose name already exists.

BEGIN;

-- 1. CSDC Praha s.r.o.
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'CSDC Praha s.r.o.', '5774152', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'CSDC Praha s.r.o.')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'CSDC Praha', 'Českomoravská 2420/15a', 'Praha 9 - Libeň', '190 00', TRUE
FROM acc;

-- 2. Delos dental s.r.o.
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'Delos dental s.r.o.', '21256080', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'Delos dental s.r.o.')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'Delos dental', 'V zahradách 843/1', 'Praha 8 - Libeň', '180 00', TRUE
FROM acc;

-- 3. DENT ART, s.r.o.
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'DENT ART, s.r.o.', '26754916', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'DENT ART, s.r.o.')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'DENT ART', 'Mladoboleslavská 11', 'Praha-Vinoř', '190 17', TRUE
FROM acc;

-- 4. Dental Modern, s.r.o.
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'Dental Modern, s.r.o.', '9204288', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'Dental Modern, s.r.o.')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'Dental Modern', 'Kartouzská 204/6', 'Praha 5 - Smíchov', '', TRUE
FROM acc;

-- 5. Dentiko Beroun
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'Dentiko Beroun', '5734185', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'Dentiko Beroun')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'Dentiko Beroun', 'Hradební 152', 'Beroun', '266 01', TRUE
FROM acc;

-- 6. Easy Dent
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'Easy Dent', '29263832', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'Easy Dent')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'Easy Dent', 'Krásova 24', 'Praha 3', '', TRUE
FROM acc;

-- 7. Hardent, s.r.o.
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'Hardent, s.r.o.', '29541981', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'Hardent, s.r.o.')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'Hardent', 'Podbělohorská 69', 'Praha 5', '', TRUE
FROM acc;

-- 8. IP-DENTAL s.r.o.
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'IP-DENTAL s.r.o.', '6569064', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'IP-DENTAL s.r.o.')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'IP-DENTAL', 'Unhošťská 2533', 'Kladno', '', TRUE
FROM acc;

-- 9. Kladný Zubař s.r.o.
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'Kladný Zubař s.r.o.', '7615299', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'Kladný Zubař s.r.o.')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'Kladný Zubař', 'Ke Stadionu 1745', 'Kladno', '272 01', TRUE
FROM acc;

-- 10. Lhdent Skalka s. r. o.
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'Lhdent Skalka s. r. o.', '2912694', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'Lhdent Skalka s. r. o.')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'Lhdent Skalka', 'Nedvězská 2223/29', 'Praha', '100 00', TRUE
FROM acc;

-- 11. MUDr. Iveta Melíšková
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'MUDr. Iveta Melíšková', '86690566', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'MUDr. Iveta Melíšková')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'MUDr. Iveta Melíšková', 'Antonína Dvořáka 302', 'Turnov', '511 01', TRUE
FROM acc;

-- 12. MUDr. Jitka Borovičková
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'MUDr. Jitka Borovičková', '71217291', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'MUDr. Jitka Borovičková')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'MUDr. Jitka Borovičková', 'Přerov nad Labem 72', 'Přerov nad Labem', '', TRUE
FROM acc;

-- 13. MUDr. Lenka Novotná
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'MUDr. Lenka Novotná', '75090759', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'MUDr. Lenka Novotná')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'MUDr. Lenka Novotná', 'Příběnická 1', 'Praha 3', '130 00', TRUE
FROM acc;

-- 14. MUDr. Petra Tlusťáková
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'MUDr. Petra Tlusťáková', '3223558', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'MUDr. Petra Tlusťáková')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'MUDr. Petra Tlusťáková', 'Trnková 955', 'Šestajovice', '250 92', TRUE
FROM acc;

-- 15. MUDr. Věra Rausová
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'MUDr. Věra Rausová', '1368010', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'MUDr. Věra Rausová')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'MUDr. Věra Rausová', 'Pavlišovská 2283/1', 'Praha 9', '', TRUE
FROM acc;

-- 16. MUDr. Veronika Škrabal Žemličková
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'MUDr. Veronika Škrabal Žemličková', '3473490', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'MUDr. Veronika Škrabal Žemličková')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'MUDr. Veronika Škrabal Žemličková', 'Hradecká 2526/3', 'Praha 3', '', TRUE
FROM acc;

-- 17. Premium MedCare s.r.o.
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  SELECT 'Premium MedCare s.r.o.', '19869169', 'active', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM dk_accounts WHERE name = 'Premium MedCare s.r.o.')
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'Premium MedCare', 'Moskevská 1464/61', 'Praha', '101 00', TRUE
FROM acc;

COMMIT;
