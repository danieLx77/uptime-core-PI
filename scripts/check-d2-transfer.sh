#!/usr/bin/env bash
set -euo pipefail
for migration in prisma/migrations/*/migration.sql; do
  psql "$LEGACY_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$migration"
done
psql "$LEGACY_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO users (id,name,email,password_hash,"updatedAt","passwordResetToken","passwordResetExpires")
VALUES ('u1','Operador','transfer@example.test','hash-fixture',now(),'token-fixture',now());
INSERT INTO monitors (id,"userId",name,url,"updatedAt")
VALUES ('m1','u1','Monitor','https://example.com',now());
INSERT INTO check_executions (id,"monitorId",status_code,response_time_ms)
VALUES ('e1','m1',503,20);
INSERT INTO incidents (id,"monitorId",status)
VALUES ('i1','m1','OPEN'), ('i2','m1','RESOLVED'), ('i3','m1','RESOLVED');
INSERT INTO alerts (id,"monitorId","incidentId",message) VALUES ('a1','m1','i1','alerta-fixture');
SQL
bash scripts/transfer-d2-data.sh

psql "$CORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF (SELECT count(*) FROM users WHERE id='u1' AND password_hash='hash-fixture'
      AND "passwordResetDigest" IS NULL AND "passwordResetExpires" IS NULL) <> 1
     OR (SELECT count(*) FROM monitors WHERE id='m1' AND "userId"='u1') <> 1
     OR (SELECT count(*) FROM check_executions WHERE id='e1' AND "monitorId"='m1') <> 1
     OR to_regclass('public.incidents') IS NOT NULL
  THEN RAISE EXCEPTION 'Dados ou isolamento do Núcleo divergentes'; END IF;
END $$;
SQL
psql "$INCIDENTS_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF (SELECT count(*) FROM incidents WHERE "monitorId"='m1' AND status='OPEN') <> 1
     OR (SELECT count(*) FROM incidents WHERE "monitorId"='m1' AND status='RESOLVED') <> 2
     OR (SELECT count(*) FROM alerts WHERE id='a1' AND "incidentId"='i1') <> 1
     OR to_regclass('public.monitors') IS NOT NULL
  THEN RAISE EXCEPTION 'Dados ou isolamento de Incidentes divergentes'; END IF;
END $$;
SQL
echo 'Transferência do D2 validada com credenciais separadas e dados preexistentes.'
