-- S1: versioned weekly capacity per person
CREATE TABLE "person_capacity_history" (
    "id" SERIAL NOT NULL,
    "person_id" INTEGER NOT NULL,
    "weekly_capacity_hours" DECIMAL(5,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,

    CONSTRAINT "person_capacity_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "person_capacity_history_person_id_effective_from_key"
    ON "person_capacity_history"("person_id", "effective_from");

CREATE INDEX "person_capacity_history_person_id_idx"
    ON "person_capacity_history"("person_id");

ALTER TABLE "person_capacity_history"
    ADD CONSTRAINT "person_capacity_history_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: treat each person's current capacity as having always been true.
-- effective_from must predate all existing memberships and hour records
-- (created_at alone can postdate them when persons were re-seeded), otherwise
-- historical months would find no capacity row.
INSERT INTO "person_capacity_history" ("person_id", "weekly_capacity_hours", "effective_from", "effective_to")
SELECT
    p."id",
    p."weekly_capacity_hours",
    LEAST(
        p."created_at"::date,
        COALESCE((SELECT MIN(sm."effective_from") FROM "squad_memberships" sm WHERE sm."person_id" = p."id"), p."created_at"::date),
        COALESCE((SELECT MIN(hr."date") FROM "hour_records" hr WHERE hr."person_id" = p."id"), p."created_at"::date)
    ),
    NULL
FROM "persons" p;

-- S3: forbid duplicate (person, role, effective_from) rows
CREATE UNIQUE INDEX "person_roles_person_id_role_type_effective_from_key"
    ON "person_roles"("person_id", "role_type", "effective_from");
