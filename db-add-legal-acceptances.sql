-- Ejecutar una vez en una base ya creada con una versión anterior de db-schema.sql.
CREATE TABLE IF NOT EXISTS legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document TEXT NOT NULL CHECK (document IN ('terms', 'privacy')),
  version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, document, version)
);
CREATE INDEX IF NOT EXISTS legal_acceptances_user_idx ON legal_acceptances (user_id, accepted_at DESC);
