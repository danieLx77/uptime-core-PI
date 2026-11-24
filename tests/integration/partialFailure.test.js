import request from 'supertest';
import coreApp from '../../services/core/src/app.js';
import { processCheckResult } from '../../services/core/src/monitoringWorkflow.js';
import { createGateway } from '../../gateway/src/app.js';
import { core } from '../support/database.js';
import { closeServer, listen } from '../support/servers.js';

let coreServer;
let gateway;

beforeAll(async () => {
  coreServer = await listen(coreApp);
});

afterAll(async () => {
  await closeServer(coreServer?.server);
  await core.$disconnect();
});

test('preserva execução e operações do Núcleo quando Incidentes está indisponível', async () => {
  const gone = await listen((_req, res) => res.end());
  await closeServer(gone.server);
  process.env.INCIDENTS_URL = gone.url;
  gateway = createGateway({ coreUrl: coreServer.url, incidentsUrl: gone.url });
  const user = await core.user.create({
    data: { name: 'Operador', email: 'falha-parcial@example.test', password_hash: 'fixture' },
  });
  const monitor = await core.monitor.create({
    data: { userId: user.id, name: 'Alvo', url: 'https://example.com' },
  });

  const result = await processCheckResult(monitor.id, {
    success: false,
    statusCode: 503,
    responseTimeMs: 25,
    errorLog: 'HTTP Error 503',
  });
  expect(result).toBeUndefined();
  expect(
    await core.checkExecution.count({ where: { monitorId: monitor.id, status_code: 503 } })
  ).toBe(1);
  await request(gateway).get('/api/admin/incidents').expect(502);
  await request(gateway).get('/api/health').expect(200);

  const restarted = await listen((_req, res) => res.end('reiniciado'));
  try {
    const available = createGateway({ coreUrl: coreServer.url, incidentsUrl: restarted.url });
    await request(available).get('/api/admin/incidents').expect(200, 'reiniciado');
    await request(available).get('/api/health').expect(200);
  } finally {
    await closeServer(restarted.server);
  }
});

test('limita o tempo do Gateway para um upstream que não responde', async () => {
  const stalled = await listen(() => {});
  try {
    gateway = createGateway({ coreUrl: coreServer.url, incidentsUrl: stalled.url, timeout: 100 });
    await request(gateway).get('/api/admin/alerts').expect(504);
    await request(gateway).get('/api/health').expect(200);
  } finally {
    await closeServer(stalled.server);
  }
});
