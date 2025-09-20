DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'plan_type'
  ) THEN
    UPDATE quotes SET plan = 'basic' WHERE plan = 'bronze';

    IF EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'plan_type' AND e.enumlabel = 'bronze'
    ) THEN
      ALTER TYPE plan_type RENAME TO plan_type_old;
      CREATE TYPE plan_type AS ENUM ('basic', 'silver', 'gold');
      ALTER TABLE quotes ALTER COLUMN plan TYPE plan_type USING plan::text::plan_type;
      DROP TYPE plan_type_old;
    END IF;
  END IF;
END $$;
