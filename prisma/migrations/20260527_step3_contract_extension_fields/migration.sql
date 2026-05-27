-- Step 3: Add resolvedRate, resolvedCurrency, updatedAt to contract_extensions
ALTER TABLE contract_extensions
  ADD COLUMN IF NOT EXISTS resolved_rate     DECIMAL(10, 4),
  ADD COLUMN IF NOT EXISTS resolved_currency currency,
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();
