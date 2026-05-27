-- Step 11: Partial indexes (raw SQL only — not expressible in Prisma schema)

-- Active client-person access (one active grant per pair)
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_client_person_access
  ON client_person_access (client_id, person_id) WHERE revoked_at IS NULL;

-- One active primary role per person
CREATE UNIQUE INDEX IF NOT EXISTS uq_primary_role_per_person
  ON person_roles (person_id) WHERE is_primary = true AND effective_to IS NULL;

-- Active anomaly flags for alert inbox
CREATE INDEX IF NOT EXISTS idx_anomaly_active
  ON anomaly_flags (client_id, month, severity) WHERE resolved_at IS NULL;
