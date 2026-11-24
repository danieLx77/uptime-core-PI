import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const base = process.env.GATEWAY_URL || 'http://127.0.0.1:3000';
const exerciseRecovery = process.argv.includes('--incidents-recovery');
if (exerciseRecovery) {
  assert.ok(
    process.env.COMPOSE_PROJECT_NAME,
    'Indique o projeto Compose descartável da demonstração.'
  );
}

function compose(...args) {
  execFileSync('docker', ['compose', ...args], { stdio: 'inherit' });
}

function fixtureSql(service, vars, sql) {
  const args = Object.entries(vars).flatMap(([key, value]) => ['-v', `${key}=${value}`]);
  execFileSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      service,
      'sh',
      '-c',
      'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"',
      'psql',
      ...args,
    ],
    { input: sql, stdio: ['pipe', 'inherit', 'inherit'] }
  );
}

async function checkIncidentsRecovery(auth, monitorId, userId) {
  const incidentId = randomUUID();
  fixtureSql(
    'core-db',
    { user_id: userId },
    "UPDATE users SET role='ADMIN' WHERE id=:'user_id';\n"
  );
  const { token } = await call('/api/auth/login', 200, { method: 'POST', body: auth });
  const vars = { incident_id: incidentId, monitor_id: monitorId };
  const history = `/api/admin/incidents?monitorId=${monitorId}`;
  fixtureSql(
    'incidents-db',
    vars,
    `INSERT INTO incidents (id,"monitorId")
    VALUES (:'incident_id', :'monitor_id');
`
  );
  let stopped = false;
  try {
    const before = await call(history, 200, { token });
    const incident = before.find(({ id }) => id === incidentId);
    assert.equal(incident?.monitor?.id, monitorId);
    console.log('200 · Incidentes disponível e consulta administrativa enriquecida.');

    stopped = true;
    compose('stop', '-t', '3', 'incidents');
    await call(history, 502, { token });
    await call('/api/health', 200);
    await call(`/api/monitors/${monitorId}`, 200, { token });
    console.log('502 · Incidentes indisponível. 200 · Núcleo continua operacional.');

    compose('up', '-d', '--wait', '--wait-timeout', '45', 'incidents');
    stopped = false;
    const after = await call(history, 200, { token });
    assert.deepEqual(
      after.find(({ id }) => id === incidentId),
      incident
    );
    console.log('200 · Incidentes recuperado. Mesmo registro e mesma projeção após reinício.');
  } finally {
    if (stopped) compose('up', '-d', '--wait', '--wait-timeout', '45', 'incidents');
    fixtureSql('incidents-db', vars, "DELETE FROM incidents WHERE id=:'incident_id';\n");
  }
}

async function call(path, status, { method = 'GET', body, token } = {}) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, status, `${method} ${path}`);
  return status === 204 ? null : response.json();
}

await call('/api/health', 200);
await call('/api/docs/core.json', 200);
await call('/api/docs/incidents.json', 200);
await call('/internal/check-results', 404, { method: 'POST', body: {} });
const email = `smoke-${randomUUID()}@example.test`;
const password = randomUUID();
const auth = { email, password };
await call('/api/auth/register', 201, { method: 'POST', body: { ...auth, name: 'Smoke D3' } });
const { token, user } = await call('/api/auth/login', 200, { method: 'POST', body: auth });
const created = await call('/api/monitors', 201, {
  method: 'POST',
  token,
  body: { name: 'Cadastro de smoke', url: 'https://monitor.example.invalid', interval_minutes: 59 },
});
assert.equal(created.userId, user.id);
assert.ok((await call('/api/monitors', 200, { token })).some((record) => record.id === created.id));
try {
  await call('/api/admin/incidents', 403, { token });
  if (exerciseRecovery) {
    await call(`/api/monitors/${created.id}`, 200, {
      method: 'PUT',
      token,
      body: { status: 'PAUSED' },
    });
    await checkIncidentsRecovery(auth, created.id, user.id);
  }
} finally {
  await call(`/api/monitors/${created.id}`, 204, { method: 'DELETE', token });
  await call(`/api/users/${user.id}`, 204, { method: 'DELETE', token });
}
console.log('Gateway, contratos, autenticação, persistência e autorização aprovados.');
