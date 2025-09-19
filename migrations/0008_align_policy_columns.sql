ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS package varchar,
  ADD COLUMN IF NOT EXISTS expiration_miles integer,
  ADD COLUMN IF NOT EXISTS expiration_date timestamp,
  ADD COLUMN IF NOT EXISTS deductible integer,
  ADD COLUMN IF NOT EXISTS total_premium integer,
  ADD COLUMN IF NOT EXISTS down_payment integer,
  ADD COLUMN IF NOT EXISTS policy_start_date timestamp,
  ADD COLUMN IF NOT EXISTS monthly_payment integer,
  ADD COLUMN IF NOT EXISTS total_payments integer;
