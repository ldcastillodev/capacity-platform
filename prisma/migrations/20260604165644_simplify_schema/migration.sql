/*
  Warnings:

  - You are about to drop the column `deactivated_at` on the `nonbillable_categories` table. All the data in the column will be lost.
  - You are about to drop the column `is_primary` on the `person_roles` table. All the data in the column will be lost.
  - You are about to drop the column `employment_type` on the `persons` table. All the data in the column will be lost.
  - You are about to drop the column `hard_buffer_pct` on the `squad_capacity_configs` table. All the data in the column will be lost.
  - You are about to drop the column `soft_buffer_pct` on the `squad_capacity_configs` table. All the data in the column will be lost.
  - You are about to drop the `client_simulation_line_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `client_simulations` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `squad_id` to the `hour_records` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "client_simulation_line_items" DROP CONSTRAINT "client_simulation_line_items_simulation_id_fkey";

-- DropForeignKey
ALTER TABLE "client_simulations" DROP CONSTRAINT "client_simulations_client_id_fkey";

-- DropForeignKey
ALTER TABLE "client_simulations" DROP CONSTRAINT "client_simulations_requested_by_fkey";

-- DropForeignKey
ALTER TABLE "hour_records" DROP CONSTRAINT "hour_records_client_id_fkey";

-- DropForeignKey
ALTER TABLE "jira_component_client_mappings" DROP CONSTRAINT "jira_component_client_mappings_contract_id_fkey";

-- AlterTable
ALTER TABLE "hour_records" ADD COLUMN     "squad_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "nonbillable_categories" DROP COLUMN "deactivated_at";

-- AlterTable
ALTER TABLE "person_roles" DROP COLUMN "is_primary";

-- AlterTable
ALTER TABLE "persons" DROP COLUMN "employment_type";

-- AlterTable
ALTER TABLE "squad_capacity_configs" DROP COLUMN "hard_buffer_pct",
DROP COLUMN "soft_buffer_pct";

-- DropTable
DROP TABLE "client_simulation_line_items";

-- DropTable
DROP TABLE "client_simulations";

-- DropEnum
DROP TYPE "EmploymentType";

-- CreateIndex
CREATE INDEX "hour_records_squad_id_date_idx" ON "hour_records"("squad_id", "date");

-- AddForeignKey
ALTER TABLE "hour_records" ADD CONSTRAINT "hour_records_squad_id_fkey" FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_records" ADD CONSTRAINT "hour_records_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jira_component_client_mappings" ADD CONSTRAINT "jira_component_client_mappings_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
