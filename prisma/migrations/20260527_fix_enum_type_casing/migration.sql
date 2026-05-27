-- Fix enum type casing: DB has lowercase names, Prisma expects camelCase.
-- PostgreSQL preserves column references automatically on RENAME.

ALTER TYPE alertlevel        RENAME TO "AlertLevel";
ALTER TYPE anomalyflagtype   RENAME TO "AnomalyFlagType";
ALTER TYPE anomalyseverity   RENAME TO "AnomalySeverity";
ALTER TYPE budgetsource      RENAME TO "BudgetSource";
ALTER TYPE changeorderstatus RENAME TO "ChangeOrderStatus";
ALTER TYPE contractstatus    RENAME TO "ContractStatus";
ALTER TYPE currency          RENAME TO "Currency";
ALTER TYPE declarationstatus RENAME TO "DeclarationStatus";
ALTER TYPE employmenttype    RENAME TO "EmploymentType";
ALTER TYPE extensionstatus   RENAME TO "ExtensionStatus";
ALTER TYPE extensiontype     RENAME TO "ExtensionType";
ALTER TYPE hoursource        RENAME TO "SyncSource";
ALTER TYPE nonbillabletype   RENAME TO "NonBillableType";
ALTER TYPE region            RENAME TO "Region";
ALTER TYPE roletype          RENAME TO "RoleType";
ALTER TYPE smesource         RENAME TO "SMESource";
ALTER TYPE smestatus         RENAME TO "SMEStatus";
ALTER TYPE suggestionstatus  RENAME TO "SuggestionStatus";
ALTER TYPE suggestiontype    RENAME TO "SuggestionType";
ALTER TYPE tebillingtype     RENAME TO "TEBillingType";
