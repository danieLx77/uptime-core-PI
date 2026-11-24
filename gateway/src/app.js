import { request as requestHttp } from 'node:http';
import { request as requestHttps } from 'node:https';
import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';

const hopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authorization',
  'proxy-authenticate',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'x-service-token',
]);

function forwardHeaders(headers) {
  const connection = new Set(
    String(headers.connection ?? '')
      .toLowerCase()
      .split(/\s*,\s*/)
  );
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !hopHeaders.has(name) && !connection.has(name))
  );
}

function baseOrigin(value) {
  const origin = new URL(value);
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  ) {
    throw new Error('Configure uma origem HTTP interna válida para o gateway.');
  }
  return origin;
}

function proxy(origin, timeout, pathOverride) {
  const request = origin.protocol === 'https:' ? requestHttps : requestHttp;
  return (req, res) => {
    const headers = forwardHeaders(req.headers);
    headers.host = origin.host;
    const deadline = AbortSignal.timeout(timeout);
    const upstream = request(
      {
        protocol: origin.protocol,
        hostname: origin.hostname,
        port: origin.port,
        path: pathOverride ?? req.originalUrl,
        method: req.method,
        headers,
        signal: deadline,
      },
      (response) => {
        res.writeHead(response.statusCode, forwardHeaders(response.headers));
        response.on('error', (error) => res.destroy(error));
        response.pipe(res);
      }
    );
    upstream.on('error', () => {
      if (res.destroyed) return;
      if (res.headersSent) return res.destroy();
      const timedOut = deadline.aborted;
      return res.status(timedOut ? 504 : 502).json({
        error: timedOut
          ? 'Tempo limite do serviço interno excedido.'
          : 'Serviço interno indisponível.',
      });
    });
    res.on('close', () => upstream.destroy());
    req.pipe(upstream);
  };
}

export function createGateway({ coreUrl, incidentsUrl, timeout = 8000 }) {
  const core = baseOrigin(coreUrl);
  const incidents = baseOrigin(incidentsUrl);
  const app = express();
  app.disable('x-powered-by');

  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.get('/gateway/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/docs/core.json', proxy(core, timeout, '/api/openapi.json'));
  app.get('/api/docs/incidents.json', proxy(incidents, timeout, '/api/openapi.json'));
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(null, {
      swaggerOptions: {
        urls: [
          { name: 'Núcleo', url: '/api/docs/core.json' },
          { name: 'Incidentes', url: '/api/docs/incidents.json' },
        ],
      },
    })
  );

  app.all(/^\/api\/admin\/(?:incidents|alerts)(?:\/|$)/i, proxy(incidents, timeout));
  app.all(/^\/api\/(?:auth|users|monitors)(?:\/|$)|^\/api\/admin(?:\/|$)/i, proxy(core, timeout));
  app.get(['/', '/api', '/api/health'], proxy(core, timeout));

  app.use((req, res) =>
    res.status(404).json({
      status: 'fail',
      message: `A rota ${req.originalUrl} não foi encontrada neste servidor.`,
    })
  );
  return app;
}
