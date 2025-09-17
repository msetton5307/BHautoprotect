CREATE TYPE document_request_type AS ENUM ('vin_photo', 'odometer_photo', 'diagnosis_report', 'repair_invoice', 'other');
CREATE TYPE document_request_status AS ENUM ('pending', 'submitted', 'completed', 'cancelled');

CREATE TABLE customer_document_requests (
    id varchar PRIMARY KEY DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    policy_id varchar NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    customer_id varchar NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
    requested_by varchar REFERENCES users(id) ON DELETE SET NULL,
    type document_request_type NOT NULL DEFAULT 'other',
    title varchar(160) NOT NULL,
    instructions text,
    status document_request_status NOT NULL DEFAULT 'pending',
    due_date timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE customer_document_uploads (
    id varchar PRIMARY KEY DEFAULT substring(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    request_id varchar NOT NULL REFERENCES customer_document_requests(id) ON DELETE CASCADE,
    customer_id varchar NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
    policy_id varchar NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_type text,
    file_size integer,
    file_data text NOT NULL,
    created_at timestamp DEFAULT now()
);
