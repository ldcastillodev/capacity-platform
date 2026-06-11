-- BR-2 (DB-level backstop): a Jira component maps to exactly one contract at
-- a time. The application now end-dates the prior open mapping on create;
-- this constraint guarantees it against direct DB writes and older routes.
--
-- Pre-apply check — must return zero rows before applying; if it returns
-- rows, deduplicate the overlapping mappings first:
--
--   SELECT a.id, b.id, a.jira_instance, a.component_key
--   FROM jira_component_client_mappings a
--   JOIN jira_component_client_mappings b
--     ON a.id < b.id
--    AND a.jira_instance = b.jira_instance
--    AND a.component_key = b.component_key
--    AND daterange(a.effective_from, a.effective_to, '[]')
--     && daterange(b.effective_from, b.effective_to, '[]');

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE jira_component_client_mappings
  ADD CONSTRAINT no_overlapping_component_mappings
  EXCLUDE USING gist (
    jira_instance WITH =,
    component_key WITH =,
    daterange(effective_from, effective_to, '[]') WITH &&
  );
