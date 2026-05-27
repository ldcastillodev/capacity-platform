-- Step 7: Add unique constraint on holiday_calendars(region, name)
-- Pre-flight found 0 duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS uq_holiday_calendar_region_name
  ON holiday_calendars (region, name);
