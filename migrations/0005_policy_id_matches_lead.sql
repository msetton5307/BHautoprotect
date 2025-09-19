-- Ensure policy identifiers match their associated lead identifiers
ALTER TABLE policies ALTER COLUMN id DROP DEFAULT;

-- Align existing policy IDs with their lead IDs
UPDATE policies SET id = lead_id;

-- Remove the no longer used policy ID sequence
ALTER SEQUENCE IF EXISTS policy_id_seq OWNED BY NONE;
DROP SEQUENCE IF EXISTS policy_id_seq;
