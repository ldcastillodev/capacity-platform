-- Step 13: Drop ClientPersonAccess unique(clientId, personId)
-- Replaced by partial unique index uq_active_client_person_access (added in Step 11)
DO $$ DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name FROM pg_constraint
  WHERE conrelid = 'client_person_access'::regclass AND contype = 'u'
  AND array_to_string(
    ARRAY(
      SELECT attname FROM pg_attribute
      WHERE attrelid = conrelid AND attnum = ANY(conkey)
      ORDER BY attnum
    ), ','
  ) IN ('client_id,person_id', 'person_id,client_id');
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE client_person_access DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;
