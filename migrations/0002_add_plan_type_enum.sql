DO $$
BEGIN
    CREATE TYPE "plan_type" AS ENUM ('basic', 'bronze', 'silver', 'gold');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "quotes"
  ALTER COLUMN "plan" TYPE "plan_type"
  USING "plan"::"plan_type";
