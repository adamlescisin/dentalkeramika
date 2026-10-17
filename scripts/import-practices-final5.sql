-- Final 5 missing practices.

WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  VALUES ('MUDr. Lenka Novotná', '75090759', 'active', NOW())
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'MUDr. Lenka Novotná', 'Příběnická 1', 'Praha 3', '130 00', TRUE FROM acc;

WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  VALUES ('MUDr. Petra Tlusťáková', '3223558', 'active', NOW())
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'MUDr. Petra Tlusťáková', 'Trnková 955', 'Šestajovice', '250 92', TRUE FROM acc;

WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  VALUES ('MUDr. Věra Rausová', '1368010', 'active', NOW())
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'MUDr. Věra Rausová', 'Pavlišovská 2283/1', 'Praha 9', '', TRUE FROM acc;

WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  VALUES ('MUDr. Veronika Škrabal Žemličková', '3473490', 'active', NOW())
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'MUDr. Veronika Škrabal Žemličková', 'Hradecká 2526/3', 'Praha 3', '', TRUE FROM acc;

WITH acc AS (
  INSERT INTO dk_accounts (name, ico, status, approved_at)
  VALUES ('Premium MedCare s.r.o.', '19869169', 'active', NOW())
  RETURNING id
)
INSERT INTO dk_locations (account_id, label, street, city, zip, is_default)
SELECT id, 'Premium MedCare', 'Moskevská 1464/61', 'Praha', '101 00', TRUE FROM acc;
