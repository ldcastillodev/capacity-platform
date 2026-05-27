-- Step 10: Add compound indexes for query performance

-- HourRecord: primary dashboard filter includes budgetSource
CREATE INDEX IF NOT EXISTS idx_hour_records_client_date_budget
  ON hour_records (client_id, date, budget_source);

-- WeeklyBurnSnapshot: alert-level dashboards
CREATE INDEX IF NOT EXISTS idx_weekly_burn_client_week_alert
  ON weekly_burn_snapshots (client_id, week_start, alert_level);

CREATE INDEX IF NOT EXISTS idx_weekly_burn_week_alert
  ON weekly_burn_snapshots (week_start, alert_level);

-- MonthlyRoleDeclaration: declaration status board
CREATE INDEX IF NOT EXISTS idx_monthly_decl_client_month_status
  ON monthly_role_declarations (client_id, month, status);

-- SyncLog: admin dashboard sort
CREATE INDEX IF NOT EXISTS idx_sync_logs_source_started
  ON sync_logs (source, started_at DESC);

-- ClientSimulation: recent simulations per client
CREATE INDEX IF NOT EXISTS idx_client_simulations_client_created
  ON client_simulations (client_id, created_at DESC);

-- AnomalyFlag: dedupe detector reruns
CREATE UNIQUE INDEX IF NOT EXISTS uq_anomaly_dedupe
  ON anomaly_flags (client_id, month, flag_type, role_type, detector_version);
