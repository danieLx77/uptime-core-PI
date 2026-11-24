BEGIN;

LOCK TABLE "incidents" IN SHARE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "incidents"
    WHERE "status" = 'OPEN'
    GROUP BY "monitorId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existem incidentes abertos duplicados. Revise as ocorrências antes de aplicar a migration.';
  END IF;
END
$$;

CREATE UNIQUE INDEX "incidents_one_open_per_monitor"
ON "incidents" ("monitorId") WHERE "status" = 'OPEN';

COMMIT;
