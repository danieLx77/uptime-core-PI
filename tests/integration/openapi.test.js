import { randomUUID } from 'node:crypto';
import request from 'supertest';
import coreSpec from '../../services/core/openapi/openapi.json' with { type: 'json' };
import incidentsSpec from '../../services/incidents/openapi/openapi.json' with { type: 'json' };
import app from '../support/gateway.js';
import { core, operational } from '../support/database.js';
import { assertJsonResponse } from '../support/openapi.js';
import { closeServer, listen } from '../support/servers.js';

const login = '/api/auth/login';
const forgot = '/api/auth/forgot-password';

test('valida login real e detecta omissão do token, tipos incorretos e status não documentado', async () => {
  const email = `contrato-${randomUUID()}@example.test`;
  const password = 'senha-de-contrato';
  const { body: user } = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Contrato login', email, password })
    .expect(201);
  try {
    const response = await request(app).post(login).send({ email, password }).expect(200);
    const check = (value) => assertJsonResponse(coreSpec, login, 'post', value);
    check(response);
    expect(() => check({ ...response, body: { user: response.body.user } })).toThrow(/token/);
    expect(() => check({ ...response, body: { ...response.body, token: 123 } })).toThrow(/string/);
    expect(() => check({ ...response, status: 418 })).toThrow(/não documentada/);
    const missing = await request(app).post(login).send({ email }).expect(400);
    check(missing);
    expect(() => check({ ...missing, body: {} })).toThrow(/required/);
  } finally {
    await core.user.delete({ where: { id: user.id } });
  }
});

test.each([{}, { email: '' }, { email: false }, { email: 'sem-arroba' }])(
  'rejeita e documenta recuperação com entrada inválida %j',
  async (body) => {
    const invalid = await request(app).post(forgot).send(body).expect(400);
    assertJsonResponse(coreSpec, forgot, 'post', invalid);
  }
);

test('valida a resposta genérica de recuperação para conta inexistente', async () => {
  const response = await request(app)
    .post(forgot)
    .send({ email: `ausente-${randomUUID()}@example.test` })
    .expect(200);
  assertJsonResponse(coreSpec, forgot, 'post', response);
});

test('valida históricos com monitor nulo, indisponibilidade do Núcleo e transições internas reais', async () => {
  const email = `admin-contrato-${randomUUID()}@example.test`;
  const password = 'senha-de-contrato';
  const { body: user } = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Admin contrato', email, password })
    .expect(201);
  await core.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
  const { body: session } = await request(app).post(login).send({ email, password }).expect(200);
  const authorization = `Bearer ${session.token}`;
  const monitorId = randomUUID();
  const internal = '/internal/check-results';
  const history = '/api/admin/incidents';
  const originalCoreUrl = process.env.CORE_URL;
  const sendResult = () =>
    request(process.env.INCIDENTS_URL)
      .post(internal)
      .set('x-service-token', process.env.INTERNAL_SERVICE_TOKEN)
      .send({
        executionId: randomUUID(),
        checkedAt: new Date().toISOString(),
        monitorId,
        success: false,
        statusCode: 503,
        errorLog: 'Falha controlada',
        monitor: { name: 'Monitor removido', url: 'https://example.test', ownerName: 'Operador' },
      });
  let malformedCore;
  try {
    const summaries = '/internal/monitors/query';
    const projection = await request(originalCoreUrl)
      .post(summaries)
      .set('x-service-token', process.env.INTERNAL_SERVICE_TOKEN)
      .send({ ids: [monitorId] })
      .expect(200);
    assertJsonResponse(coreSpec, summaries, 'post', projection);
    expect(projection.body).toEqual([]);

    const transition = await sendResult().expect(200);
    assertJsonResponse(incidentsSpec, internal, 'post', transition);
    expect(transition.body.stateChanged).toBe(true);
    for (const body of [{ stateChanged: true }, { stateChanged: true, incidentId: null }]) {
      expect(() =>
        assertJsonResponse(incidentsSpec, internal, 'post', { ...transition, body })
      ).toThrow();
    }
    const repeat = await sendResult().expect(200);
    assertJsonResponse(incidentsSpec, internal, 'post', repeat);
    expect(repeat.body).toEqual({ stateChanged: false, incidentId: transition.body.incidentId });

    const list = () =>
      request(app).get(history).query({ monitorId }).set('Authorization', authorization);
    const current = await list().expect(200);
    assertJsonResponse(incidentsSpec, history, 'get', current);
    expect(current.body).toHaveLength(1);
    expect(current.body[0].monitor).toBeNull();
    expect(() =>
      assertJsonResponse(incidentsSpec, history, 'get', {
        ...current,
        body: [{ ...current.body[0], monitor: false }],
      })
    ).toThrow();

    malformedCore = await listen((_req, res) =>
      res.writeHead(200, { 'content-type': 'application/json' }).end('[{}]')
    );
    process.env.CORE_URL = malformedCore.url;
    const unavailable = await list().expect(503);
    assertJsonResponse(incidentsSpec, history, 'get', unavailable);
  } finally {
    process.env.CORE_URL = originalCoreUrl;
    await closeServer(malformedCore?.server);
    await operational.alert.deleteMany({ where: { monitorId } });
    await operational.incident.deleteMany({ where: { monitorId } });
    await core.user.delete({ where: { id: user.id } });
  }
});

afterAll(async () => {
  await Promise.all([core.$disconnect(), operational.$disconnect()]);
});
