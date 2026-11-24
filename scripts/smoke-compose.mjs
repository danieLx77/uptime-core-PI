import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.GATEWAY_URL || 'http://127.0.0.1:3000';

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
await call('/api/admin/incidents', 403, { token });
await call(`/api/monitors/${created.id}`, 204, { method: 'DELETE', token });
await call(`/api/users/${user.id}`, 204, { method: 'DELETE', token });
console.log('Gateway, contratos, autenticação, persistência e autorização aprovados.');
