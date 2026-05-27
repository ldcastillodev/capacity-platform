-- Step 2: Add snapshot columns to staffing_gap_snapshots
ALTER TABLE staffing_gap_snapshots
  ADD COLUMN IF NOT EXISTS capacity_hours_at_time  DECIMAL(8, 2),
  ADD COLUMN IF NOT EXISTS hard_buffer_pct_at_time DECIMAL(5, 4),
  ADD COLUMN IF NOT EXISTS soft_buffer_pct_at_time DECIMAL(5, 4);
