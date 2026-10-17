-- Remaining 11 practices (the first 6 from the original file already landed).

-- 7. Hardent, s.r.o.
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  VALUES ('Hardent, s.r.o.', '29541981', 'active', NOW())
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'Hardent', 'Podbělohorská 69', 'Praha 5', '', TRUE FROM acc;

-- 8. IP-DENTAL s.r.o.
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  VALUES ('IP-DENTAL s.r.o.', '6569064', 'active', NOW())
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'IP-DENTAL', 'Unhošťská 2533', 'Kladno', '', TRUE FROM acc;

-- 9. Kladný Zubař s.r.o.
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  VALUES ('Kladný Zubař s.r.o.', '7615299', 'active', NOW())
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'Kladný Zubař', 'Ke Stadionu 1745', 'Kladno', '272 01', TRUE FROM acc;

-- 10. Lhdent Skalka s. r. o.
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  VALUES ('Lhdent Skalka s. r. o.', '2912694', 'active', NOW())
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'Lhdent Skalka', 'Nedvězská 2223/29', 'Praha', '100 00', TRUE FROM acc;

-- 11. MUDr. Iveta Melíšková
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  VALUES ('MUDr. Iveta Melíšková', '86690566', 'active', NOW())
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'MUDr. Iveta Melíšková', 'Antonína Dvořáka 302', 'Turnov', '511 01', TRUE FROM acc;

-- 12. MUDr. Jitka Borovičková
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  VALUES ('MUDr. Jitka Borovičková', '71217291', 'active', NOW())
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'MUDr. Jitka Borovičková', 'Přerov nad Labem 72', 'Přerov nad Labem', '', TRUE FROM acc;

-- 13. MUDr. Lenka Novotná
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  VALUES ('MUDr. Lenka Novotná', '75090759', 'active', NOW())
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'MUDr. Lenka Novotná', 'Příběnická 1', 'Praha 3', '130 00', TRUE FROM acc;

-- 14. MUDr. Petra Tlusťáková
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  VALUES ('MUDr. Petra Tlusťáková', '3223558', 'active', NOW())
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'MUDr. Petra Tlusťáková', 'Trnková 955', 'Šestajovice', '250 92', TRUE FROM acc;

-- 15. MUDr. Věra Rausová
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  VALUES ('MUDr. Věra Rausová', '1368010', 'active', NOW())
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'MUDr. Věra Rausová', 'Pavlišovská 2283/1', 'Praha 9', '', TRUE FROM acc;

-- 16. MUDr. Veronika Škrabal Žemličková
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  VALUES ('MUDr. Veronika Škrabal Žemličková', '3473490', 'active', NOW())
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'MUDr. Veronika Škrabal Žemličková', 'Hradecká 2526/3', 'Praha 3', '', TRUE FROM acc;

-- 17. Premium MedCare s.r.o.
WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  VALUES ('Premium MedCare s.r.o.', '19869169', 'active', NOW())
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'Premium MedCare', 'Moskevská 1464/61', 'Praha', '101 00', TRUE FROM acc;
