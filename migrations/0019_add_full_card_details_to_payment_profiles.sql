ALTER TABLE customer_payment_profiles ADD COLUMN IF NOT EXISTS card_number text;
ALTER TABLE customer_payment_profiles ADD COLUMN IF NOT EXISTS card_cvv varchar(4);
