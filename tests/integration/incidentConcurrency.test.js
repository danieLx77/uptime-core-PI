import request from 'supertest';
import { randomUUID } from 'node:crypto';
import app from '../../services/incidents/src/app.js';
import { operational } from '../support/database.js';
import { runOverlappingWrites } from '../support/concurrency.js';

function submit(monitorId, success) {
  return request(app)
    .post('/internal/check-results')
    .set('X-Service-Token', process.env.INTERNAL_SERVICE_TOKEN)
    .send({
      executionId: randomUUID(),
      checkedAt: new Date().toISOString(),
      monitorId,
      success,
      statusCode: success ? 200 : 503,
      errorLog: success ? null : 'HTTP Error 503',
      monitor: { name: 'Alvo de teste', url: 'https://example.com', ownerName: 'Operador' },
    })
    .expect(200);
}

afterAll(() => operational.$disconnect());

test('serializa a abertura e a resolução concorrentes e preserva o histórico', async () => {
  const monitorId = randomUUID();
  const another = randomUUID();
  const failures = await runOverlappingWrites(
    operational,
    'incidents',
    Array.from({ length: 3 }, () => () => submit(monitorId, false).then((r) => r.body))
  );
  expect(failures.filter((result) => result.stateChanged)).toHaveLength(1);
  expect(await operational.incident.count({ where: { monitorId, status: 'OPEN' } })).toBe(1);
  expect(await operational.alert.count({ where: { monitorId } })).toBe(1);

  const recoveries = await runOverlappingWrites(
    operational,
    'incidents',
    Array.from({ length: 2 }, () => () => submit(monitorId, true).then((r) => r.body))
  );
  expect(recoveries.filter((result) => result.stateChanged)).toHaveLength(1);
  expect(await operational.alert.count({ where: { monitorId } })).toBe(2);
  expect(await operational.incident.count({ where: { monitorId, status: 'OPEN' } })).toBe(0);

  await submit(monitorId, false);
  await submit(monitorId, true);
  await submit(another, false);
  expect(await operational.incident.count({ where: { monitorId, status: 'RESOLVED' } })).toBe(2);
  expect(await operational.incident.count({ where: { monitorId: another, status: 'OPEN' } })).toBe(
    1
  );
}, 20000);

test('protege a ingestão e valida o corpo interno', async () => {
  await request(app)
    .post('/internal/check-results')
    .set('Authorization', 'Bearer token')
    .send({})
    .expect(401);
  await request(app)
    .post('/internal/check-results')
    .set('X-Service-Token', process.env.INTERNAL_SERVICE_TOKEN)
    .send({})
    .expect(400);
});
