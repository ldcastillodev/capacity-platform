-- BR-11: the sum of allocation_pct across a person's overlapping squad
-- memberships must never exceed 1.0 at any point in time. A CHECK or EXCLUDE
-- constraint cannot express a cross-row aggregate, so this is a constraint
-- trigger.
--
-- Pre-apply check — must return zero rows before applying; if it returns
-- rows, the data needs review first (the trigger would make those rows
-- un-updatable):
--
--   SELECT b.person_id, b.day, sum(sm.allocation_pct) AS total
--   FROM (SELECT DISTINCT person_id, effective_from AS day FROM squad_memberships) b
--   JOIN squad_memberships sm
--     ON sm.person_id = b.person_id
--    AND daterange(sm.effective_from, sm.effective_to, '[]') @> b.day
--   GROUP BY b.person_id, b.day
--   HAVING sum(sm.allocation_pct) > 1.0;

CREATE OR REPLACE FUNCTION enforce_allocation_sum() RETURNS trigger AS $$
DECLARE
  max_total numeric;
BEGIN
  -- Serialize membership writes per person so two concurrent inserts cannot
  -- each pass the check and together exceed 1.0 (lock released at commit).
  PERFORM pg_advisory_xact_lock(42001, NEW.person_id);

  -- The running per-day sum only increases on a row's effective_from, so
  -- checking each start day inside the new row's range covers the maximum.
  SELECT max(total) INTO max_total
  FROM (
    SELECT sum(sm.allocation_pct) AS total
    FROM (
      SELECT NEW.effective_from AS day
      UNION
      SELECT effective_from FROM squad_memberships
      WHERE person_id = NEW.person_id
        AND effective_from > NEW.effective_from
        AND (NEW.effective_to IS NULL OR effective_from <= NEW.effective_to)
    ) b
    JOIN squad_memberships sm
      ON sm.person_id = NEW.person_id
     AND daterange(sm.effective_from, sm.effective_to, '[]') @> b.day
    GROUP BY b.day
  ) t;

  IF max_total > 1.0 THEN
    RAISE EXCEPTION 'allocation_sum_exceeded: person % would reach allocation % (max 1.0)',
      NEW.person_id, max_total;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER allocation_sum_check
  AFTER INSERT OR UPDATE ON squad_memberships
  FOR EACH ROW EXECUTE FUNCTION enforce_allocation_sum();
