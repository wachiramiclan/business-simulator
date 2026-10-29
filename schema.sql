CREATE TABLE IF NOT EXISTS scenarios (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  mode       TEXT NOT NULL CHECK (mode IN ('new', 'old')),
  inputs     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
