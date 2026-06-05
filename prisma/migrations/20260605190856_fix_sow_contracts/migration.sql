-- DropIndex
DROP INDEX "contracts_parent_contract_id_key";

-- DropIndex
DROP INDEX "statements_of_work_parent_sow_id_key";

-- CreateIndex
CREATE INDEX "contracts_parent_contract_id_idx" ON "contracts"("parent_contract_id");

-- CreateIndex
CREATE INDEX "statements_of_work_parent_sow_id_idx" ON "statements_of_work"("parent_sow_id");
