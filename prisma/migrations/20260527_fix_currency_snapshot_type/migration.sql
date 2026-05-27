-- Fix currency_snapshot column type from text to Currency enum
ALTER TABLE hour_records
  ALTER COLUMN currency_snapshot TYPE currency USING currency_snapshot::currency;
