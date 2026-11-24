#!/usr/bin/env bash
set -euo pipefail

: "${LEGACY_DATABASE_URL:?Configure o snapshot PostgreSQL do D2}"
: "${CORE_DATABASE_URL:?Configure o banco vazio do Núcleo}"
: "${INCIDENTS_DATABASE_URL:?Configure o banco vazio de Incidentes}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
stage='pré-validação'
progress='Nenhum destino foi gravado por esta execução.'
scratch="$(mktemp -d)"
finish() {
  local status=$?
  if (( status != 0 )); then
    printf 'Transferência interrompida na etapa %s. %s\n' "$stage" "$progress" >&2
  fi
  rm -f "$scratch"/{users,monitors,executions,incidents,alerts,monitor_ids}.csv
  rmdir "$scratch"
}
trap finish EXIT

identify() {
  psql "$1" -X -w -v ON_ERROR_STOP=1 -Atc "
    SELECT (SELECT system_identifier::text FROM pg_catalog.pg_control_system()) || ':' ||
      (SELECT oid::text FROM pg_catalog.pg_database WHERE datname = current_database())"
}
expected_migrations() {
  local file checksum separator=''
  printf '{'
  for file in "$script_dir/../services/$1/prisma/migrations/"*/migration.sql; do
    checksum="$(sha256sum "$file")" || return
    printf '%s"%s":"%s"' "$separator" "$(basename "$(dirname "$file")")" "${checksum%% *}"
    separator=','
  done
  printf '}'
}
destination() {
  psql "$1" -X -w -v ON_ERROR_STOP=1 -v expected_identity="$2" \
    -v expected_migrations="$3" -v core_target="$4" -v target_checks="$script_dir/check-transfer-target.sql"
}

stage='identidade da origem'
legacy_identity="$(identify "$LEGACY_DATABASE_URL")"
stage='identidade do Núcleo'
core_identity="$(identify "$CORE_DATABASE_URL")"
stage='identidade de Incidentes'
incidents_identity="$(identify "$INCIDENTS_DATABASE_URL")"
stage='separação dos bancos'
if [[ -z "$legacy_identity" || -z "$core_identity" || -z "$incidents_identity" ||
      "$legacy_identity" == "$core_identity" || "$legacy_identity" == "$incidents_identity" ||
      "$core_identity" == "$incidents_identity" ]]; then
  echo 'Forneça uma origem e dois destinos fisicamente distintos.' >&2
  exit 1
fi

core_migrations="$(expected_migrations core)"
incidents_migrations="$(expected_migrations incidents)"
stage='pré-validação do Núcleo'
destination "$CORE_DATABASE_URL" "$core_identity" "$core_migrations" true <<'SQL'
BEGIN;
\i :target_checks
ROLLBACK;
SQL
stage='pré-validação de Incidentes'
destination "$INCIDENTS_DATABASE_URL" "$incidents_identity" "$incidents_migrations" false <<'SQL'
BEGIN;
\i :target_checks
ROLLBACK;
SQL
echo 'Pré-validação dos dois destinos concluída.'
cd "$scratch"

stage='snapshot somente leitura do D2'
psql "$LEGACY_DATABASE_URL" -X -w -v ON_ERROR_STOP=1 -v expected_identity="$legacy_identity" <<'SQL'
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL row_security = off;
SELECT (
  (SELECT system_identifier::text FROM pg_catalog.pg_control_system()) || ':' ||
  (SELECT oid::text FROM pg_catalog.pg_database WHERE datname = current_database())
) = :'expected_identity' AS matching_identity \gset
\if :matching_identity
\else
  DO $$ BEGIN RAISE EXCEPTION 'A identidade da origem mudou após a verificação.'; END $$;
\endif
DO $$ BEGIN
  IF EXISTS (
    SELECT "monitorId" FROM incidents UNION ALL SELECT "monitorId" FROM alerts
    EXCEPT SELECT id FROM monitors
  ) THEN RAISE EXCEPTION 'Referências a monitores ausentes no snapshot.'; END IF;
  IF EXISTS (
    SELECT a.id FROM alerts a JOIN incidents i ON i.id = a."incidentId"
    WHERE a."monitorId" <> i."monitorId"
  ) THEN RAISE EXCEPTION 'Alerta e incidente associados a monitores distintos no snapshot.'; END IF;
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

stage='transferência do Núcleo'
progress='Somente o Núcleo pode ter recebido dados. Verifique se o commit ocorreu.'
destination "$CORE_DATABASE_URL" "$core_identity" "$core_migrations" true <<'SQL'
BEGIN;
\i :target_checks
\copy users(id,name,email,password_hash,role,"createdAt","updatedAt") FROM 'users.csv' CSV
\copy monitors(id,"userId",name,url,interval_minutes,status,"createdAt","updatedAt") FROM 'monitors.csv' CSV
\copy check_executions(id,"monitorId",status_code,response_time_ms,timestamp) FROM 'executions.csv' CSV
SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM monitors) AS monitors,
       (SELECT count(*) FROM check_executions) AS executions;
COMMIT;
SQL

echo 'Núcleo confirmado.'
stage='transferência de Incidentes'
progress='O Núcleo foi confirmado. Verifique se Incidentes recebeu dados antes da recuperação.'
destination "$INCIDENTS_DATABASE_URL" "$incidents_identity" "$incidents_migrations" false <<'SQL'
BEGIN;
\i :target_checks
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
echo 'Incidentes confirmado. Confira os dois destinos antes de liberar os serviços.'
