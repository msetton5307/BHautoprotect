ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS shipping_address text,
  ADD COLUMN IF NOT EXISTS shipping_city varchar(120),
  ADD COLUMN IF NOT EXISTS shipping_state varchar(120),
  ADD COLUMN IF NOT EXISTS shipping_zip varchar(32),
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS billing_city varchar(120),
  ADD COLUMN IF NOT EXISTS billing_state varchar(120),
  ADD COLUMN IF NOT EXISTS billing_zip varchar(32),
  ADD COLUMN IF NOT EXISTS shipping_same_as_billing boolean DEFAULT false;

UPDATE leads
SET shipping_same_as_billing = false
WHERE shipping_same_as_billing IS NULL;
