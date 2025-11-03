ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "sub_id" varchar(255);

ALTER TYPE "lead_status" ADD VALUE IF NOT EXISTS 'qualified';
ALTER TYPE "lead_status" ADD VALUE IF NOT EXISTS 'converted';
