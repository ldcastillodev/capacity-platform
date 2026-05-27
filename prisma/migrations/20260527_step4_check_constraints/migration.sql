-- Step 4: Add CHECK constraints
-- Pre-flight diagnostics showed 0 violations for all constraints.

-- 4a: HourRecord budget polymorphism (all 4 budget sources)
ALTER TABLE hour_records ADD CONSTRAINT chk_hour_budget_source CHECK (
  (budget_source = 'retainer'     AND contract_extension_id IS NULL     AND change_order_id IS NULL     AND sme_engagement_id IS NULL) OR
  (budget_source = 'te'           AND contract_extension_id IS NOT NULL AND change_order_id IS NULL     AND sme_engagement_id IS NULL) OR
  (budget_source = 'change_order' AND contract_extension_id IS NULL     AND change_order_id IS NOT NULL AND sme_engagement_id IS NULL) OR
  (budget_source = 'sme'          AND contract_extension_id IS NULL     AND change_order_id IS NULL     AND sme_engagement_id IS NOT NULL)
);

-- 4b: MonthlyRoleDeclaration source exclusivity
ALTER TABLE monthly_role_declarations
  ADD CONSTRAINT chk_declaration_source CHECK (
    (contract_id IS NOT NULL AND extension_id IS NULL)
    OR (contract_id IS NULL AND extension_id IS NOT NULL)
  );

-- 4c: CostRate must have at least one identifying dimension
ALTER TABLE cost_rates ADD CONSTRAINT chk_rate_identity
  CHECK (person_id IS NOT NULL OR role_type IS NOT NULL);

-- 4d: SMEEngagement source integrity
ALTER TABLE sme_engagements ADD CONSTRAINT chk_sme_source_data CHECK (
  (source = 'internal_other_squad' AND person_id IS NOT NULL)
  OR (source = 'external_contractor')
);
