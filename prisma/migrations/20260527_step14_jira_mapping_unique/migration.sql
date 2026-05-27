-- Step 14: Refactor JiraComponentClientMapping unique to include jiraInstance
-- Existing constraint name: jira_component_client_mappings_component_key_effective_from_key
ALTER TABLE jira_component_client_mappings
  DROP CONSTRAINT IF EXISTS jira_component_client_mappings_component_key_effective_from_key;

ALTER TABLE jira_component_client_mappings
  ADD CONSTRAINT uq_jira_mapping UNIQUE (jira_instance, component_key, effective_from);
