/*
  Warnings:

  - The values [tempo] on the enum `NbMappingSource` will be removed. If these variants are still used in the database, this will fail.
  - The values [tempo] on the enum `SyncSource` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `tempo_account_id` on the `persons` table. All the data in the column will be lost.
  - You are about to drop the `tempo_account_client_mappings` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NbMappingSource_new" AS ENUM ('jira_na');
ALTER TABLE "nonbillable_source_mappings" ALTER COLUMN "source" TYPE "NbMappingSource_new" USING ("source"::text::"NbMappingSource_new");
ALTER TYPE "NbMappingSource" RENAME TO "NbMappingSource_old";
ALTER TYPE "NbMappingSource_new" RENAME TO "NbMappingSource";
DROP TYPE "NbMappingSource_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "SyncSource_new" AS ENUM ('jira_na', 'manual', 'api');
ALTER TABLE "hour_records" ALTER COLUMN "source" TYPE "SyncSource_new" USING ("source"::text::"SyncSource_new");
ALTER TABLE "sync_logs" ALTER COLUMN "source" TYPE "SyncSource_new" USING ("source"::text::"SyncSource_new");
ALTER TYPE "SyncSource" RENAME TO "SyncSource_old";
ALTER TYPE "SyncSource_new" RENAME TO "SyncSource";
DROP TYPE "SyncSource_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "tempo_account_client_mappings" DROP CONSTRAINT "tempo_account_client_mappings_client_id_fkey";

-- DropIndex
DROP INDEX "persons_tempo_account_id_key";

-- AlterTable
ALTER TABLE "persons" DROP COLUMN "tempo_account_id";

-- DropTable
DROP TABLE "tempo_account_client_mappings";
