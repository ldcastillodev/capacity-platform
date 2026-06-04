-- Existing component→client mappings are invalidated by the schema change.
-- All rows are removed; mappings must be re-entered via the management UI.
DELETE FROM jira_component_client_mappings;

ALTER TABLE jira_component_client_mappings
  DROP COLUMN client_id;

ALTER TABLE jira_component_client_mappings
  ADD COLUMN contract_id INTEGER NOT NULL REFERENCES contracts(id);
