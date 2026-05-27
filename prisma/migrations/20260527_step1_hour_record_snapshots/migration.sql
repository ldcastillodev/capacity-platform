-- Step 1: Add snapshot columns to hour_records
ALTER TABLE hour_records
  ADD COLUMN IF NOT EXISTS billing_rate_snapshot DECIMAL(10, 4),
  ADD COLUMN IF NOT EXISTS cost_rate_snapshot    DECIMAL(10, 4),
  ADD COLUMN IF NOT EXISTS currency_snapshot     TEXT,
  ADD COLUMN IF NOT EXISTS billed_amount_snapshot DECIMAL(12, 4),
  ADD COLUMN IF NOT EXISTS cost_amount_snapshot  DECIMAL(12, 4);
