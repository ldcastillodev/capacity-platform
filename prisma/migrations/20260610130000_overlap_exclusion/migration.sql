-- S2: DB-level overlap enforcement for temporal rows.
-- squad_id is part of the membership constraint: concurrent memberships in
-- DIFFERENT squads are legitimate (split allocations).
-- '[]' (closed) intervals match the application's inclusive effectiveTo
-- semantics (effectiveTo >= date; rows are end-dated at new_start - 1 day).
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE squad_memberships
  ADD CONSTRAINT no_overlapping_memberships
  EXCLUDE USING gist (
    person_id WITH =,
    squad_id WITH =,
    daterange(effective_from, effective_to, '[]') WITH &&
  );

ALTER TABLE person_roles
  ADD CONSTRAINT no_overlapping_roles
  EXCLUDE USING gist (
    person_id WITH =,
    daterange(effective_from, effective_to, '[]') WITH &&
  );
