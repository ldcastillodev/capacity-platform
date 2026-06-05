/*
  Warnings:

  - The values [frontend_dev,backend_dev,fullstack_dev,ux_designer,product_manager,project_manager,tech_lead,solutions_architect,data_engineer,scrum_master,business_analyst,content_author,client_services] on the enum `RoleType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RoleType_new" AS ENUM ('dev', 'devops', 'qa', 'data', 'design', 'product', 'project', 'tl', 'sre', 'seo', 'content');
ALTER TABLE "person_roles" ALTER COLUMN "role_type" TYPE "RoleType_new" USING ("role_type"::text::"RoleType_new");
ALTER TABLE "monthly_role_declarations" ALTER COLUMN "role_type" TYPE "RoleType_new" USING ("role_type"::text::"RoleType_new");
ALTER TABLE "hour_records" ALTER COLUMN "role_type" TYPE "RoleType_new" USING ("role_type"::text::"RoleType_new");
ALTER TABLE "anomaly_flags" ALTER COLUMN "role_type" TYPE "RoleType_new" USING ("role_type"::text::"RoleType_new");
ALTER TYPE "RoleType" RENAME TO "RoleType_old";
ALTER TYPE "RoleType_new" RENAME TO "RoleType";
DROP TYPE "RoleType_old";
COMMIT;
