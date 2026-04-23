ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "affiliate_id" integer,
  ADD COLUMN IF NOT EXISTS "campaign_id" integer,
  ADD COLUMN IF NOT EXISTS "access_key" varchar(128),
  ADD COLUMN IF NOT EXISTS "sub_id2" varchar,
  ADD COLUMN IF NOT EXISTS "sub_id3" varchar,
  ADD COLUMN IF NOT EXISTS "trusted_form_cert_url" text,
  ADD COLUMN IF NOT EXISTS "source_url" text,
  ADD COLUMN IF NOT EXISTS "universal_lead_id" varchar(255);
