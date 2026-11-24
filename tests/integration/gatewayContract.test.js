import request from 'supertest';
import app from '../support/gateway.js';
import { createGateway } from '../../gateway/src/app.js';
import { closeServer, listen } from '../support/servers.js';

test('separa documentação e bloqueia as rotas de serviço no Gateway', async () => {
  for (const service of ['core', 'incidents']) {
    const spec = await request(app).get(`/api/docs/${service}.json`).expect(200);
    expect(spec.body.openapi).toBe('3.0.3');
  }
  await request(app).get('/api/docs/').expect(200);
  await request(app)
    .post('/internal/check-results')
    .set('X-Service-Token', process.env.INTERNAL_SERVICE_TOKEN)
    .send({})
    .expect(404);
  await request(app).post('/internal/monitors/query').send({ ids: [] }).expect(404);
});

test('preserva método, query, corpo, cabeçalho e status sem repassar credencial de serviço', async () => {
  const upstream = await listen(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    res.statusCode = 202;
    res.setHeader('content-type', 'application/json');
    res.setHeader('x-upstream', 'checked');
    res.end(
      JSON.stringify({
        method: req.method,
        path: req.url,
        body: JSON.parse(Buffer.concat(chunks).toString()),
        auth: req.headers.authorization,
        serviceToken: req.headers['x-service-token'] ?? null,
      })
    );
  });
  try {
    const gateway = createGateway({ coreUrl: upstream.url, incidentsUrl: upstream.url });
    const response = await request(gateway)
      .put('/api/monitors/42?filter=x%20y')
      .set('Authorization', 'Bearer public-fixture')
      .set('X-Service-Token', 'teste-interno-nao-repassado')
      .send({ name: 'Alvo revisado' })
      .expect(202)
      .expect('x-upstream', 'checked');
    expect(response.body).toEqual({
      method: 'PUT',
      path: '/api/monitors/42?filter=x%20y',
      body: { name: 'Alvo revisado' },
      auth: 'Bearer public-fixture',
      serviceToken: null,
    });
  } finally {
    await closeServer(upstream.server);
  }
});
