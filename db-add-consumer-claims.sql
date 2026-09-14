-- Ejecutar una vez en la base PostgreSQL ya existente, desde Vercel Storage > Query.
CREATE TABLE IF NOT EXISTS consumer_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_code TEXT NOT NULL UNIQUE,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('reclamo', 'queja')),
  first_name TEXT NOT NULL CHECK (char_length(first_name) BETWEEN 2 AND 100),
  last_name TEXT NOT NULL CHECK (char_length(last_name) BETWEEN 2 AND 100),
  document_type TEXT NOT NULL CHECK (document_type IN ('DNI', 'CE', 'Pasaporte', 'Otro')),
  document_number TEXT NOT NULL CHECK (char_length(document_number) BETWEEN 4 AND 30),
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL CHECK (char_length(address) BETWEEN 5 AND 300),
  parent_or_guardian TEXT,
  service_description TEXT NOT NULL CHECK (char_length(service_description) BETWEEN 5 AND 500),
  amount NUMERIC(10,2),
  detail TEXT NOT NULL CHECK (char_length(detail) BETWEEN 10 AND 5000),
  request_detail TEXT NOT NULL CHECK (char_length(request_detail) BETWEEN 5 AND 3000),
  privacy_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'in_progress', 'resolved')),
  response_detail TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS consumer_claims_created_idx ON consumer_claims (created_at DESC);
