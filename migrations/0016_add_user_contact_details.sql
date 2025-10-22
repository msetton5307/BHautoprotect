ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "full_name" varchar(160),
  ADD COLUMN IF NOT EXISTS "email" varchar(160),
  ADD COLUMN IF NOT EXISTS "phone" varchar(32),
  ADD COLUMN IF NOT EXISTS "title" varchar(120);

ALTER TABLE "quotes"
  ADD COLUMN IF NOT EXISTS "created_by" varchar
    REFERENCES "users"("id") ON DELETE SET NULL;
