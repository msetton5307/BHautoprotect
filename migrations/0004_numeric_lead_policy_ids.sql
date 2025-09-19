-- Ensure sequences exist for deterministic 8-digit identifiers
CREATE SEQUENCE IF NOT EXISTS lead_id_seq START WITH 10000000 MINVALUE 10000000;
CREATE SEQUENCE IF NOT EXISTS policy_id_seq START WITH 10000000 MINVALUE 10000000;

-- Prepare new identifiers for leads and policies
ALTER TABLE leads ADD COLUMN new_id varchar(8);
UPDATE leads SET new_id = lpad(nextval('lead_id_seq')::text, 8, '0');

ALTER TABLE policies ADD COLUMN new_id varchar(8);
UPDATE policies SET new_id = lpad(nextval('policy_id_seq')::text, 8, '0');

-- Drop foreign key constraints so references can be updated safely
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_lead_id_leads_id_fk;
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_lead_id_leads_id_fk;
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_lead_id_leads_id_fk;
ALTER TABLE policies DROP CONSTRAINT IF EXISTS policies_lead_id_leads_id_fk;

ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_policy_id_policies_id_fk;
ALTER TABLE policy_notes DROP CONSTRAINT IF EXISTS policy_notes_policy_id_policies_id_fk;
ALTER TABLE policy_files DROP CONSTRAINT IF EXISTS policy_files_policy_id_policies_id_fk;
ALTER TABLE customer_policies DROP CONSTRAINT IF EXISTS customer_policies_policy_id_policies_id_fk;
ALTER TABLE customer_payment_profiles DROP CONSTRAINT IF EXISTS customer_payment_profiles_policy_id_policies_id_fk;
ALTER TABLE customer_document_requests DROP CONSTRAINT IF EXISTS customer_document_requests_policy_id_policies_id_fk;
ALTER TABLE customer_document_uploads DROP CONSTRAINT IF EXISTS customer_document_uploads_policy_id_policies_id_fk;

-- Update references to the newly generated identifiers
UPDATE vehicles v SET lead_id = l.new_id FROM leads l WHERE v.lead_id = l.id;
UPDATE quotes q SET lead_id = l.new_id FROM leads l WHERE q.lead_id = l.id;
UPDATE notes n SET lead_id = l.new_id FROM leads l WHERE n.lead_id = l.id;
UPDATE policies p SET lead_id = l.new_id FROM leads l WHERE p.lead_id = l.id;

UPDATE claims c SET policy_id = p.new_id FROM policies p WHERE c.policy_id = p.id;
UPDATE policy_notes pn SET policy_id = p.new_id FROM policies p WHERE pn.policy_id = p.id;
UPDATE policy_files pf SET policy_id = p.new_id FROM policies p WHERE pf.policy_id = p.id;
UPDATE customer_policies cp SET policy_id = p.new_id FROM policies p WHERE cp.policy_id = p.id;
UPDATE customer_payment_profiles cpp SET policy_id = p.new_id FROM policies p WHERE cpp.policy_id = p.id;
UPDATE customer_document_requests cdr SET policy_id = p.new_id FROM policies p WHERE cdr.policy_id = p.id;
UPDATE customer_document_uploads cdu SET policy_id = p.new_id FROM policies p WHERE cdu.policy_id = p.id;

-- Apply the new identifiers
UPDATE leads SET id = new_id;
UPDATE policies SET id = new_id;

ALTER TABLE leads DROP COLUMN new_id;
ALTER TABLE policies DROP COLUMN new_id;

-- Align column types and defaults with the new identifier format
ALTER TABLE leads ALTER COLUMN id TYPE varchar(8);
ALTER TABLE policies ALTER COLUMN id TYPE varchar(8);

ALTER TABLE leads ALTER COLUMN id SET DEFAULT lpad(nextval('lead_id_seq')::text, 8, '0');
ALTER SEQUENCE lead_id_seq OWNED BY leads.id;

ALTER TABLE policies ALTER COLUMN id SET DEFAULT lpad(nextval('policy_id_seq')::text, 8, '0');
ALTER SEQUENCE policy_id_seq OWNED BY policies.id;

-- Enforce numeric-only identifiers
ALTER TABLE leads ADD CONSTRAINT leads_id_digits_ck CHECK (id ~ '^[0-9]{8}$');
ALTER TABLE policies ADD CONSTRAINT policies_id_digits_ck CHECK (id ~ '^[0-9]{8}$');

-- Recreate foreign key constraints with cascading updates
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_lead_id_leads_id_fk
  FOREIGN KEY (lead_id) REFERENCES leads(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE quotes
  ADD CONSTRAINT quotes_lead_id_leads_id_fk
  FOREIGN KEY (lead_id) REFERENCES leads(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE notes
  ADD CONSTRAINT notes_lead_id_leads_id_fk
  FOREIGN KEY (lead_id) REFERENCES leads(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE policies
  ADD CONSTRAINT policies_lead_id_leads_id_fk
  FOREIGN KEY (lead_id) REFERENCES leads(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE claims
  ADD CONSTRAINT claims_policy_id_policies_id_fk
  FOREIGN KEY (policy_id) REFERENCES policies(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE policy_notes
  ADD CONSTRAINT policy_notes_policy_id_policies_id_fk
  FOREIGN KEY (policy_id) REFERENCES policies(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE policy_files
  ADD CONSTRAINT policy_files_policy_id_policies_id_fk
  FOREIGN KEY (policy_id) REFERENCES policies(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE customer_policies
  ADD CONSTRAINT customer_policies_policy_id_policies_id_fk
  FOREIGN KEY (policy_id) REFERENCES policies(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE customer_payment_profiles
  ADD CONSTRAINT customer_payment_profiles_policy_id_policies_id_fk
  FOREIGN KEY (policy_id) REFERENCES policies(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE customer_document_requests
  ADD CONSTRAINT customer_document_requests_policy_id_policies_id_fk
  FOREIGN KEY (policy_id) REFERENCES policies(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE customer_document_uploads
  ADD CONSTRAINT customer_document_uploads_policy_id_policies_id_fk
  FOREIGN KEY (policy_id) REFERENCES policies(id)
  ON DELETE CASCADE ON UPDATE CASCADE;
