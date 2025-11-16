CREATE TABLE IF NOT EXISTS policy_docusign_envelopes (
  id varchar PRIMARY KEY DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  policy_id varchar(8) NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  lead_id varchar(8) NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  envelope_id varchar(128) NOT NULL,
  status text,
  last_event text,
  completed_at timestamp,
  documents_downloaded_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS policy_docusign_envelopes_envelope_id_idx
  ON policy_docusign_envelopes (envelope_id);
CREATE INDEX IF NOT EXISTS policy_docusign_envelopes_policy_id_idx
  ON policy_docusign_envelopes (policy_id);
CREATE INDEX IF NOT EXISTS policy_docusign_envelopes_lead_id_idx
  ON policy_docusign_envelopes (lead_id);
