ALTER TABLE policy_charges
  ADD COLUMN reference varchar(120);
ALTER TABLE policy_charges
  ADD COLUMN invoice_file_name text;
ALTER TABLE policy_charges
  ADD COLUMN invoice_file_path text;
ALTER TABLE policy_charges
  ADD COLUMN invoice_file_type text;
ALTER TABLE policy_charges
  ADD COLUMN invoice_file_size integer;
