-- Ettaka database schema v2 (PostgreSQL 14+)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,
  pin_hash      TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'lc_official', 'mediator', 'admin')),
  title         TEXT,
  district      TEXT,
  photo         TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL UNIQUE,
  record_type      TEXT NOT NULL CHECK (record_type IN ('sale', 'gift', 'inheritance', 'customary_claim')),
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sealed')),
  title            TEXT NOT NULL,
  district         TEXT,
  subcounty        TEXT,
  village          TEXT,
  tenure           TEXT DEFAULT 'customary' CHECK (tenure IN ('customary', 'kibanja', 'mailo', 'freehold', 'leasehold', 'unknown')),
  plot_description TEXT,
  price_ugx        BIGINT,
  payment_terms    TEXT,
  terms_transcript TEXT,
  agreement_en     TEXT,
  agreement_lg     TEXT,
  family_land      BOOLEAN NOT NULL DEFAULT false,
  spouse_name      TEXT,
  spouse_consent   BOOLEAN NOT NULL DEFAULT false,
  boundary         JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [[lat, lng], ...]
  area_m2          NUMERIC(14, 2),
  created_by       INTEGER REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  sealed_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS parties (
  id           SERIAL PRIMARY KEY,
  record_id    UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('seller', 'buyer', 'owner', 'co_owner', 'spouse', 'heir', 'donor', 'recipient')),
  full_name    TEXT NOT NULL,
  phone        TEXT,
  gender       TEXT CHECK (gender IN ('female', 'male', 'other') OR gender IS NULL),
  confirmed    BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS witnesses (
  id         SERIAL PRIMARY KEY,
  record_id  UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL,
  title      TEXT,
  phone      TEXT,
  statement  TEXT,
  confirmed  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS evidence (
  id            SERIAL PRIMARY KEY,
  record_id     UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('boundary_photo', 'old_document', 'audio', 'signature', 'identity_photo', 'other')),
  filename      TEXT NOT NULL,
  original_name TEXT,
  mime          TEXT,
  size_bytes    INTEGER,
  sha256        TEXT NOT NULL,
  caption       TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only, hash-chained seal ledger.
CREATE TABLE IF NOT EXISTS seals (
  id         SERIAL PRIMARY KEY,
  record_id  UUID NOT NULL REFERENCES records(id),
  seal_hash  TEXT NOT NULL UNIQUE,
  prev_hash  TEXT NOT NULL,
  payload    JSONB NOT NULL,
  sealed_by  INTEGER REFERENCES users(id),
  sealed_at  TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION seals_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'The seal ledger is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS seals_no_update ON seals;
CREATE TRIGGER seals_no_update BEFORE UPDATE OR DELETE ON seals
  FOR EACH ROW EXECUTE FUNCTION seals_append_only();

-- Disputes move through a mediation pipeline.
CREATE TABLE IF NOT EXISTS disputes (
  id           SERIAL PRIMARY KEY,
  record_id    UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  complainant  TEXT,
  respondent   TEXT,
  category     TEXT NOT NULL DEFAULT 'ownership' CHECK (category IN ('boundary', 'ownership', 'inheritance', 'eviction', 'double_sale', 'payment', 'other')),
  stage        TEXT NOT NULL DEFAULT 'reported' CHECK (stage IN ('reported', 'lc_review', 'mediation', 'resolved', 'escalated')),
  priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  referred_to  TEXT,
  mediator_id  INTEGER REFERENCES users(id),
  session_at   TIMESTAMPTZ,
  venue        TEXT,
  outcome      TEXT,
  created_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ
);

-- Every check made on the public verification portal.
CREATE TABLE IF NOT EXISTS verifications (
  id            SERIAL PRIMARY KEY,
  code          TEXT NOT NULL,
  record_id     UUID REFERENCES records(id) ON DELETE SET NULL,
  found         BOOLEAN NOT NULL,
  valid         BOOLEAN,
  verifier_type TEXT NOT NULL DEFAULT 'public' CHECK (verifier_type IN ('public', 'buyer', 'lender', 'mediator', 'court', 'official')),
  ip_hash       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit trail of significant actions.
CREATE TABLE IF NOT EXISTS activity (
  id         SERIAL PRIMARY KEY,
  actor_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT,
  action     TEXT NOT NULL,
  record_id  UUID REFERENCES records(id) ON DELETE CASCADE,
  summary    TEXT NOT NULL,
  details    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'info' CHECK (kind IN ('info', 'success', 'warning', 'danger')),
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Identity photos captured at the time of the transaction (sealed as evidence).
ALTER TABLE parties ADD COLUMN IF NOT EXISTS photo_evidence_id INTEGER REFERENCES evidence(id) ON DELETE SET NULL;
ALTER TABLE witnesses ADD COLUMN IF NOT EXISTS photo_evidence_id INTEGER REFERENCES evidence(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT;

CREATE INDEX IF NOT EXISTS idx_parties_record ON parties(record_id);
CREATE INDEX IF NOT EXISTS idx_parties_phone ON parties(phone);
CREATE INDEX IF NOT EXISTS idx_witnesses_record ON witnesses(record_id);
CREATE INDEX IF NOT EXISTS idx_evidence_record ON evidence(record_id);
CREATE INDEX IF NOT EXISTS idx_seals_record ON seals(record_id);
CREATE INDEX IF NOT EXISTS idx_disputes_record ON disputes(record_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verifications_created ON verifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
