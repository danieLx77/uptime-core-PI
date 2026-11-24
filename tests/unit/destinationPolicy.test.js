import { jest } from '@jest/globals';
import { setTimeout as delay } from 'node:timers/promises';
import { closeServer, listen } from '../support/servers.js';
import { createPingService } from '../../services/core/src/modules/monitoring/PingService.js';
import {
  createPublicLookup,
  parseMonitorUrl,
} from '../../services/core/src/modules/monitoring/destinationPolicy.js';

test.each(['http://example.com', 'https://example.com'])('aceita o protocolo de %s', (url) => {
  expect(parseMonitorUrl(url).hostname).toBe('example.com');
});

test.each([
  'file:///etc/hosts',
  'http://a:b@example.com',
  'http://127.0.0.1',
  'http://10.1.1.1',
  'http://169.254.169.254',
  'http://[fd00::1]',
  'http://[fe80::1]',
  'http://[::]',
  'http://[::ffff:127.0.0.1]',
  'http://2130706433',
  'http://224.0.0.1',
  'http://198.18.0.1',
])('rejeita destino ou sintaxe proibida em %s', (url) => {
  expect(() => parseMonitorUrl(url)).toThrow();
});

function resolveVia(lookup) {
  return new Promise((resolve, reject) => {
    lookup('test.example', { all: true }, (error, addresses) =>
      error ? reject(error) : resolve(addresses)
    );
  });
}

test('valida todos os resultados DNS a cada conexão, inclusive mudanças de resolução', async () => {
  const publicRecords = [
    { address: '93.184.216.34', family: 4 },
    { address: '2606:4700::1', family: 6 },
  ];
  const resolver = jest
    .fn()
    .mockResolvedValueOnce(publicRecords)
    .mockResolvedValueOnce([...publicRecords, { address: '127.0.0.1', family: 4 }]);
  const lookup = createPublicLookup(resolver);
  await expect(resolveVia(lookup)).resolves.toEqual(publicRecords);
  await expect(resolveVia(lookup)).rejects.toMatchObject({ code: 'MONITOR_DESTINATION_BLOCKED' });
  expect(resolver).toHaveBeenCalledTimes(2);
});

test('bloqueia redirecionamentos e limita tempo e tamanho usando um servidor local controlado', async () => {
  const paths = [];
  const target = await listen(async (req, res) => {
    paths.push(req.url);
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: '/ok' }).end();
    } else if (req.url === '/large') {
      res.end(Buffer.alloc(1024 * 1024 + 1));
    } else if (req.url === '/slow') {
      await delay(250);
      res.end('ok');
    } else {
      res.end('ok');
    }
  });
  const old = process.env.MONITORING_TEST_ORIGIN;
  process.env.MONITORING_TEST_ORIGIN = target.url;
  try {
    const ping = createPingService();
    await expect(ping.execute(target.url + '/ok')).resolves.toMatchObject({
      success: true,
      statusCode: 200,
    });
    await expect(ping.execute(target.url + '/redirect')).rejects.toMatchObject({
      code: 'MONITOR_DESTINATION_BLOCKED',
    });
    expect(paths).toEqual(['/ok', '/redirect']);
    await expect(ping.execute(target.url + '/large')).resolves.toMatchObject({
      success: false,
      errorLog: 'Resposta excedeu o limite de 1 MiB.',
    });
    await expect(
      createPingService({ deadline: () => AbortSignal.timeout(50) }).execute(target.url + '/slow')
    ).resolves.toMatchObject({ success: false, errorLog: 'Timeout (10000ms)' });
  } finally {
    if (old === undefined) delete process.env.MONITORING_TEST_ORIGIN;
    else process.env.MONITORING_TEST_ORIGIN = old;
    await closeServer(target.server);
  }
});
