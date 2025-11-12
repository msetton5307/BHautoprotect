CREATE TABLE IF NOT EXISTS lead_policy_drafts (
  lead_id varchar(8) PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  package varchar,
  expiration_miles integer,
  expiration_date timestamp,
  deductible integer,
  total_premium integer,
  down_payment integer,
  policy_start_date timestamp,
  monthly_payment integer,
  total_payments integer,
  payment_option varchar(16)
);
