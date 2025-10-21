ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS card_number text,
  ADD COLUMN IF NOT EXISTS card_expiry_month varchar(2),
  ADD COLUMN IF NOT EXISTS card_expiry_year varchar(4),
  ADD COLUMN IF NOT EXISTS card_cvv varchar(4);
