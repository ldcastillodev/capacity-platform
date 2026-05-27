-- Step 12: Drop Person.costPerHour — replaced by CostRate table
ALTER TABLE persons DROP COLUMN IF EXISTS cost_per_hour;
