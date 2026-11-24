import { jest } from '@jest/globals';
import { sendCheckResult } from '../../services/core/src/incidentsClient.js';
import { attachMonitors } from '../../services/incidents/src/coreClient.js';

const monitor = {
  id: 'm1',
  userId: 'u1',
  name: 'Monitor',
  url: 'https://example.test',
  status: 'ACTIVE',
};
const record = { monitorId: monitor.id };
let mockFetch;

beforeEach(() => {
  process.env.CORE_URL = 'http://core.example.test';
  process.env.INCIDENTS_URL = 'http://incidents.example.test';
  mockFetch = jest.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  mockFetch.mockRestore();
  delete process.env.CORE_URL;
  delete process.env.INCIDENTS_URL;
});

test('preserva a projeção válida e representa uma ausência real com monitor nulo', async () => {
  mockFetch.mockResolvedValue(Response.json([monitor]));
  await expect(attachMonitors([record, { monitorId: 'm2' }])).resolves.toEqual([
    { ...record, monitor },
    { monitorId: 'm2', monitor: null },
  ]);
});

test.each([
  ['objeto em vez de lista', {}],
  ['sem identificador', [{ ...monitor, id: undefined }]],
  ['campo obrigatório ausente', [{ ...monitor, userId: undefined }]],
  ['tipo incorreto', [{ ...monitor, url: null }]],
  ['estado inválido', [{ ...monitor, status: 'UNKNOWN' }]],
  ['identificador não solicitado', [{ ...monitor, id: 'm2' }]],
  ['identificador repetido', [monitor, monitor]],
])('rejeita projeção com %s como indisponibilidade, sem simular ausência', async (_label, body) => {
  mockFetch.mockResolvedValue(Response.json(body));
  await expect(attachMonitors([record])).rejects.toMatchObject({
    status: 503,
    message: 'Núcleo indisponível.',
  });
});

test.each([
  { stateChanged: true, incidentId: 'i1' },
  { stateChanged: false, incidentId: 'i1' },
  { stateChanged: false, incidentId: null },
])('aceita confirmação válida %j', async (transition) => {
  mockFetch.mockResolvedValue(Response.json(transition));
  await expect(sendCheckResult({})).resolves.toEqual(transition);
});

test.each([
  { stateChanged: true },
  { stateChanged: false },
  { stateChanged: true, incidentId: null },
  { stateChanged: true, incidentId: ' ' },
  { stateChanged: false, incidentId: 12 },
  { stateChanged: 'false', incidentId: null },
])('rejeita confirmação incompatível %j', async (transition) => {
  mockFetch.mockResolvedValue(Response.json(transition));
  await expect(sendCheckResult({})).rejects.toThrow('Resposta inválida de Incidentes.');
});

test('rejeita JSON malformado ou vazio nos dois clientes', async () => {
  mockFetch
    .mockResolvedValueOnce(new Response('{', { headers: { 'content-type': 'application/json' } }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response('{', { headers: { 'content-type': 'application/json' } }));
  await expect(sendCheckResult({})).rejects.toThrow('Resposta inválida de Incidentes.');
  await expect(sendCheckResult({})).rejects.toThrow('Resposta inválida de Incidentes.');
  await expect(attachMonitors([record])).rejects.toMatchObject({ status: 503 });
});

test('rejeita sucesso fora do status e do tipo de conteúdo documentados', async () => {
  mockFetch
    .mockResolvedValueOnce(
      Response.json({ stateChanged: false, incidentId: null }, { status: 201 })
    )
    .mockResolvedValueOnce(new Response(JSON.stringify([monitor]), { status: 200 }));
  await expect(sendCheckResult({})).rejects.toThrow('Resposta inválida de Incidentes.');
  await expect(attachMonitors([record])).rejects.toMatchObject({ status: 503 });
});
