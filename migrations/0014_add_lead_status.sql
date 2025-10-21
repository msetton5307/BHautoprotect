CREATE TYPE "lead_status" AS ENUM (
  'new',
  'quoted',
  'callback',
  'left-message',
  'no-contact',
  'wrong-number',
  'fake-lead',
  'not-interested',
  'duplicate-lead',
  'dnc',
  'sold'
);

ALTER TABLE "leads"
  ADD COLUMN "status" "lead_status" NOT NULL DEFAULT 'new';
