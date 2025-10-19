ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "raw_payload" jsonb;
ALTER TABLE "leads" ALTER COLUMN "created_at" SET DEFAULT now();
