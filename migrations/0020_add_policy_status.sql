DO $$
BEGIN
  CREATE TYPE policy_status AS ENUM ('active', 'deactivated');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS status policy_status NOT NULL DEFAULT 'active';

UPDATE policies
SET status = 'active'
WHERE status IS NULL;

ALTER TABLE policies
  ALTER COLUMN status SET DEFAULT 'active';
