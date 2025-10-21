ALTER TABLE policies
  DROP CONSTRAINT IF EXISTS policies_lead_id_leads_id_fk;

ALTER TABLE policies
  ADD CONSTRAINT policies_lead_id_leads_id_fk
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
