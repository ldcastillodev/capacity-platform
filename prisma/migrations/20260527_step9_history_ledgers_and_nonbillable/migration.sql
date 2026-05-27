-- Step 9: Create history ledger tables and NonBillableCategory soft-delete columns

-- NonBillableCategory soft-delete columns
ALTER TABLE nonbillable_categories
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- MonthlyRoleDeclarationHistory
CREATE TABLE IF NOT EXISTS monthly_role_declaration_history (
  id                  SERIAL PRIMARY KEY,
  declaration_id      INT NOT NULL REFERENCES monthly_role_declarations(id),
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by          INT,
  prev_declared_hours DECIMAL(8, 2),
  new_declared_hours  DECIMAL(8, 2),
  prev_status         declarationstatus,
  new_status          declarationstatus,
  reason              TEXT
);
CREATE INDEX IF NOT EXISTS idx_mrd_history_decl_changed
  ON monthly_role_declaration_history (declaration_id, changed_at);

-- ContractAmendment
CREATE TABLE IF NOT EXISTS contract_amendments (
  id             SERIAL PRIMARY KEY,
  contract_id    INT NOT NULL REFERENCES retainer_contracts(id),
  effective_from DATE NOT NULL,
  prev_pool_hours DECIMAL(8, 2) NOT NULL,
  new_pool_hours  DECIMAL(8, 2) NOT NULL,
  reason         TEXT,
  changed_by     INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contract_amendments_contract_eff
  ON contract_amendments (contract_id, effective_from);

-- ContractExtensionHistory
CREATE TABLE IF NOT EXISTS contract_extension_history (
  id                   SERIAL PRIMARY KEY,
  extension_id         INT NOT NULL REFERENCES contract_extensions(id),
  changed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by           INT,
  prev_status          extensionstatus,
  new_status           extensionstatus,
  prev_requested_hours DECIMAL(8, 2),
  new_requested_hours  DECIMAL(8, 2),
  prev_rate_override   DECIMAL(10, 4),
  new_rate_override    DECIMAL(10, 4)
);
CREATE INDEX IF NOT EXISTS idx_ceh_extension_changed
  ON contract_extension_history (extension_id, changed_at);

-- ChangeOrderHistory
CREATE TABLE IF NOT EXISTS change_order_history (
  id              SERIAL PRIMARY KEY,
  change_order_id INT NOT NULL REFERENCES change_orders(id),
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by      INT,
  prev_status     changeorderstatus,
  new_status      changeorderstatus,
  prev_notes      TEXT
);
CREATE INDEX IF NOT EXISTS idx_coh_change_order_changed
  ON change_order_history (change_order_id, changed_at);

-- ChangeOrderLineItemHistory
CREATE TABLE IF NOT EXISTS change_order_line_item_history (
  id               SERIAL PRIMARY KEY,
  line_item_id     INT NOT NULL REFERENCES change_order_line_items(id),
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by       INT,
  prev_hours       DECIMAL(8, 2),
  new_hours        DECIMAL(8, 2),
  prev_rate_override DECIMAL(10, 4),
  new_rate_override  DECIMAL(10, 4)
);
CREATE INDEX IF NOT EXISTS idx_colih_line_item_changed
  ON change_order_line_item_history (line_item_id, changed_at);

-- SMEEngagementHistory
CREATE TABLE IF NOT EXISTS sme_engagement_history (
  id               SERIAL PRIMARY KEY,
  engagement_id    INT NOT NULL REFERENCES sme_engagements(id),
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by       INT,
  prev_status      smestatus,
  new_status       smestatus,
  prev_billing_rate DECIMAL(10, 4),
  new_billing_rate  DECIMAL(10, 4),
  prev_cost_rate   DECIMAL(10, 4),
  new_cost_rate    DECIMAL(10, 4)
);
CREATE INDEX IF NOT EXISTS idx_seh_engagement_changed
  ON sme_engagement_history (engagement_id, changed_at);
