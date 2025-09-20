DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_status') THEN
    CREATE TYPE contract_status AS ENUM ('draft', 'sent', 'signed', 'void');
  END IF;
END $$;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS salesperson_email varchar(255);

CREATE TABLE IF NOT EXISTS lead_contracts (
  id varchar PRIMARY KEY DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  lead_id varchar(8) NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  quote_id varchar REFERENCES quotes(id) ON DELETE SET NULL,
  uploaded_by varchar REFERENCES users(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer,
  file_data text NOT NULL,
  status contract_status NOT NULL DEFAULT 'draft',
  signature_name text,
  signature_email text,
  signature_ip varchar(64),
  signature_user_agent text,
  signature_consent boolean DEFAULT false,
  signed_at timestamp,
  payment_method text,
  payment_last_four varchar(4),
  payment_exp_month integer,
  payment_exp_year integer,
  payment_notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_contracts_lead_id_idx ON lead_contracts (lead_id);
CREATE INDEX IF NOT EXISTS lead_contracts_quote_id_idx ON lead_contracts (quote_id);
