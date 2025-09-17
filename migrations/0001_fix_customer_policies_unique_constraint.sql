BEGIN;

WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY customer_id, policy_id
      ORDER BY created_at NULLS LAST, id
    ) AS row_number
  FROM customer_policies
)
DELETE FROM customer_policies
WHERE id IN (
  SELECT id
  FROM duplicates
  WHERE row_number > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_policies_unique_idx
  ON customer_policies (customer_id, policy_id);

COMMIT;
