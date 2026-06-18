import type { SyncSource } from "@prisma/client";

export interface JiraInstance {
  /** jiraInstance code stored on JiraComponentClientMapping */
  value: string;
  label: string;
  /** SyncSource enum value stored on HourRecord/SyncLog/SyncConflict */
  source: SyncSource;
  /** env var prefix for this instance's credentials */
  envPrefix: string;
}

export const JIRA_INSTANCES: readonly JiraInstance[] = [
  { value: "na", label: "NA", source: "jira_na", envPrefix: "JIRA_NA" },
  { value: "emea", label: "EMEA", source: "jira_emea", envPrefix: "JIRA_EMEA" },
] as const;
