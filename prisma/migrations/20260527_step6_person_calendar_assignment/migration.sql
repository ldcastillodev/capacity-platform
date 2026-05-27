-- Step 6: Add effectiveTo and unique index to person_calendar_assignments
ALTER TABLE person_calendar_assignments ADD COLUMN IF NOT EXISTS effective_to DATE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_person_calendar_eff_from
  ON person_calendar_assignments (person_id, effective_from);
