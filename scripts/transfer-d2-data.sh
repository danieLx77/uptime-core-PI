#!/usr/bin/env bash
set -euo pipefail

: "${LEGACY_DATABASE_URL:?Configure o snapshot PostgreSQL do D2}"
: "${CORE_DATABASE_URL:?Configure o banco vazio do Núcleo}"
: "${INCIDENTS_DATABASE_URL:?Configure o banco vazio de Incidentes}"
if [[ "$LEGACY_DATABASE_URL" == "$CORE_DATABASE_URL" || "$LEGACY_DATABASE_URL" == "$INCIDENTS_DATABASE_URL" ||
      "$CORE_DATABASE_URL" == "$INCIDENTS_DATABASE_URL" ]]; then
  echo 'Forneça uma origem e dois destinos distintos.' >&2
  exit 1
fi

scratch="$(mktemp -d)"
trap 'rm -f "$scratch"/{users,monitors,executions,incidents,alerts,monitor_ids}.csv; rmdir "$scratch"' EXIT
cd "$scratch"

psql "$LEGACY_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM incidents WHERE status = 'OPEN' GROUP BY "monitorId" HAVING count(*) > 1)
  THEN RAISE EXCEPTION 'Há incidentes abertos duplicados. Revise o snapshot antes da transferência.';
  END IF;
END $$;
\copy (SELECT id,name,email,password_hash,role,"createdAt","updatedAt" FROM users) TO 'users.csv' CSV
\copy (SELECT id,"userId",name,url,interval_minutes,status,"createdAt","updatedAt" FROM monitors) TO 'monitors.csv' CSV
\copy (SELECT id,"monitorId",status_code,response_time_ms,timestamp FROM check_executions) TO 'executions.csv' CSV
\copy (SELECT id,"monitorId",status,"errorLog","startedAt","resolvedAt" FROM incidents) TO 'incidents.csv' CSV
\copy (SELECT id,"monitorId","incidentId",type,message,"sentAt" FROM alerts) TO 'alerts.csv' CSV
\copy (SELECT id FROM monitors) TO 'monitor_ids.csv' CSV
COMMIT;
SQL

psql "$CORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
LOCK TABLE users, monitors, check_executions IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT FROM users UNION ALL SELECT FROM monitors UNION ALL SELECT FROM check_executions)
  THEN RAISE EXCEPTION 'O destino Núcleo deve estar vazio.';
  END IF;
END $$;
\copy users(id,name,email,password_hash,role,"createdAt","updatedAt") FROM 'users.csv' CSV
\copy monitors(id,"userId",name,url,interval_minutes,status,"createdAt","updatedAt") FROM 'monitors.csv' CSV
\copy check_executions(id,"monitorId",status_code,response_time_ms,timestamp) FROM 'executions.csv' CSV
SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM monitors) AS monitors,
       (SELECT count(*) FROM check_executions) AS executions;
COMMIT;
SQL

psql "$INCIDENTS_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
LOCK TABLE incidents, alerts IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT FROM incidents UNION ALL SELECT FROM alerts)
  THEN RAISE EXCEPTION 'O destino Incidentes deve estar vazio.';
  END IF;
END $$;
CREATE TEMP TABLE legacy_monitors (id text PRIMARY KEY) ON COMMIT DROP;
\copy legacy_monitors FROM 'monitor_ids.csv' CSV
\copy incidents(id,"monitorId",status,"errorLog","startedAt","resolvedAt") FROM 'incidents.csv' CSV
\copy alerts(id,"monitorId","incidentId",type,message,"sentAt") FROM 'alerts.csv' CSV
DO $$ BEGIN
  IF EXISTS (
    SELECT "monitorId" FROM incidents UNION ALL SELECT "monitorId" FROM alerts
    EXCEPT SELECT id FROM legacy_monitors
  ) THEN RAISE EXCEPTION 'Referências a monitores ausentes no snapshot.';
  END IF;
END $$;
SELECT (SELECT count(*) FROM incidents) AS incidents, (SELECT count(*) FROM alerts) AS alerts;
COMMIT;
SQL
