CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE customer_payment_profiles
  ADD COLUMN IF NOT EXISTS card_brand varchar(40),
  ADD COLUMN IF NOT EXISTS card_last_four varchar(4),
  ADD COLUMN IF NOT EXISTS card_expiry_month integer,
  ADD COLUMN IF NOT EXISTS card_expiry_year integer,
  ADD COLUMN IF NOT EXISTS billing_zip varchar(16);
