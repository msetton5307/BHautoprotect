DO $$
BEGIN
  CREATE TYPE policy_charge_status AS ENUM ('pending','processing','paid','failed','refunded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE customer_payment_profiles
  ADD COLUMN IF NOT EXISTS card_brand varchar(40),
  ADD COLUMN IF NOT EXISTS card_last_four varchar(4),
  ADD COLUMN IF NOT EXISTS card_expiry_month integer,
  ADD COLUMN IF NOT EXISTS card_expiry_year integer,
  ADD COLUMN IF NOT EXISTS billing_zip varchar(16);

CREATE TABLE IF NOT EXISTS policy_charges (
  id varchar(8) PRIMARY KEY DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  policy_id varchar(8) NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  customer_id varchar REFERENCES customer_accounts(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount_cents integer NOT NULL,
  status policy_charge_status NOT NULL DEFAULT 'pending',
  charged_at timestamp NOT NULL DEFAULT now(),
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS policy_charges_policy_id_idx ON policy_charges(policy_id);
CREATE INDEX IF NOT EXISTS policy_charges_customer_id_idx ON policy_charges(customer_id);
