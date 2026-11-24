#!/usr/bin/env bash
set -euo pipefail

query() {
  psql "$1" -X -w -v ON_ERROR_STOP=1 -Atc "$2"
}
for entry in LEGACY_DATABASE_URL:legacy_d2_fixture CORE_DATABASE_URL:core_transfer_fixture \
    INCIDENTS_DATABASE_URL:incidents_transfer_fixture; do
  env_name="${entry%:*}"
  expected_database="${entry#*:}"
  if [[ "$(query "${!env_name}" 'SELECT current_database()')" != "$expected_database" ]]; then
    echo "A suíte de transferência exige o banco descartável $expected_database." >&2
    exit 1
  fi
done
for migration in prisma/migrations/*/migration.sql; do
  psql "$LEGACY_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$migration"
done
psql "$LEGACY_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO users (id,name,email,password_hash,"updatedAt","passwordResetToken","passwordResetExpires")
VALUES ('u1','Operador','transfer@example.test','hash-fixture','2026-01-01 01:02:03','token-fixture',now());
INSERT INTO monitors (id,"userId",name,url,"updatedAt")
VALUES ('m1','u1','Monitor','https://example.com',now());
INSERT INTO check_executions (id,"monitorId",status_code,response_time_ms)
VALUES ('e1','m1',503,20);
INSERT INTO incidents (id,"monitorId",status)
VALUES ('i1','m1','OPEN'), ('i2','m1','RESOLVED'), ('i3','m1','RESOLVED');
INSERT INTO alerts (id,"monitorId","incidentId",message) VALUES ('a1','m1','i1','alerta-fixture');
SQL
expect_failure() {
  local expected="$1" output
  shift
  if output="$("$@" 2>&1)"; then
    echo "Transferência deveria falhar: $expected." >&2
    return 1
  fi
  if [[ "$output" != *"$expected"* ]]; then
    printf '%s\n' "$output" >&2
    return 1
  fi
  echo "Falha esperada confirmada: $expected"
}

assert_core_empty() {
  [[ "$(query "$CORE_DATABASE_URL" 'SELECT count(*) FROM users')" == 0 ]]
}

with_alias() {
  local separator='?'
  [[ "$1" != *\?* ]] || separator='&'
  printf '%s%sapplication_name=alias-da-fixture' "$1" "$separator"
}

expect_failure 'fisicamente distintos' env CORE_DATABASE_URL="$(with_alias "$LEGACY_DATABASE_URL")" \
  bash scripts/transfer-d2-data.sh
expect_failure 'fisicamente distintos' env INCIDENTS_DATABASE_URL="$(with_alias "$CORE_DATABASE_URL")" \
  bash scripts/transfer-d2-data.sh
assert_core_empty

query "$INCIDENTS_DATABASE_URL" "INSERT INTO incidents(id,\"monitorId\") VALUES ('fixture-ocupada','m0')"
expect_failure 'O destino deve estar vazio.' bash scripts/transfer-d2-data.sh
assert_core_empty
[[ "$(query "$INCIDENTS_DATABASE_URL" 'SELECT count(*) FROM incidents')" == 1 ]]
query "$INCIDENTS_DATABASE_URL" "DELETE FROM incidents WHERE id = 'fixture-ocupada'"

query "$INCIDENTS_DATABASE_URL" 'ALTER TABLE alerts RENAME COLUMN message TO temporary_message'
expect_failure 'pré-validação de Incidentes' bash scripts/transfer-d2-data.sh
assert_core_empty
query "$INCIDENTS_DATABASE_URL" 'ALTER TABLE alerts RENAME COLUMN temporary_message TO message'

query "$INCIDENTS_DATABASE_URL" 'ALTER TABLE _prisma_migrations ADD COLUMN fixture_checksum text'
query "$INCIDENTS_DATABASE_URL" "UPDATE _prisma_migrations SET fixture_checksum=checksum, checksum='incompatível'"
expect_failure 'Histórico de migrations incompatível' bash scripts/transfer-d2-data.sh
assert_core_empty
query "$INCIDENTS_DATABASE_URL" 'UPDATE _prisma_migrations SET checksum=fixture_checksum'
query "$INCIDENTS_DATABASE_URL" 'ALTER TABLE _prisma_migrations DROP COLUMN fixture_checksum'

# A falha existe somente no banco descartável de teste. A pré-validação não dispara o trigger.
psql "$INCIDENTS_DATABASE_URL" -X -w -v ON_ERROR_STOP=1 <<'SQL'
CREATE FUNCTION fail_fixture_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Falha simulada após confirmar Núcleo'; END;
$$;
CREATE TRIGGER fail_fixture_insert BEFORE INSERT ON alerts
FOR EACH ROW EXECUTE FUNCTION fail_fixture_insert();
SQL
expect_failure 'O Núcleo foi confirmado. Verifique se Incidentes recebeu dados' bash scripts/transfer-d2-data.sh
[[ "$(query "$CORE_DATABASE_URL" 'SELECT count(*) FROM users')" == 1 ]]
[[ "$(query "$INCIDENTS_DATABASE_URL" 'SELECT count(*) FROM incidents')" == 0 ]]
[[ "$(query "$INCIDENTS_DATABASE_URL" 'SELECT count(*) FROM alerts')" == 0 ]]
expect_failure 'O destino deve estar vazio.' bash scripts/transfer-d2-data.sh

# Restaura o estado inicial vazio apenas nos bancos de fixture já identificados.
query "$INCIDENTS_DATABASE_URL" 'DROP TRIGGER fail_fixture_insert ON alerts; DROP FUNCTION fail_fixture_insert()'
query "$CORE_DATABASE_URL" 'TRUNCATE check_executions, monitors, users'
bash scripts/transfer-d2-data.sh

psql "$CORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF (SELECT count(*) FROM users WHERE id='u1' AND password_hash='hash-fixture'
      AND "updatedAt" = timestamp '2026-01-01 01:02:03'
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
psql "$LEGACY_DATABASE_URL" -X -w -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF (SELECT count(*) FROM users WHERE id='u1' AND "passwordResetToken"='token-fixture'
      AND password_hash='hash-fixture') <> 1
     OR (SELECT count(*) FROM monitors) <> 1
     OR (SELECT count(*) FROM check_executions) <> 1
     OR (SELECT count(*) FROM incidents) <> 3
     OR (SELECT count(*) FROM alerts) <> 1
  THEN RAISE EXCEPTION 'A origem foi alterada'; END IF;
END $$;
SQL
echo 'Transferência do D2 validada com credenciais separadas e dados preexistentes.'
