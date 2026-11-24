import express from 'express';
import spec from '../openapi/openapi.json' with { type: 'json' };
import { default as authenticate } from './auth.js';
import { default as requireAdmin } from './isAdmin.js';
import { adminRoutes as incidentRoutes, incidentService } from './modules/incidents/index.js';
import { adminRoutes as notificationRoutes, alertService } from './modules/notifications/index.js';
import { requireService } from './serviceAuth.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/openapi.json', (_req, res) => res.json(spec));
app.use('/api/admin', authenticate, requireAdmin, incidentRoutes, notificationRoutes);

function validId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 80;
}

app.post('/internal/check-results', requireService, async (req, res) => {
  const { executionId, checkedAt, monitorId, success, statusCode, errorLog, monitor } =
    req.body || {};
  if (
    !validId(executionId) ||
    !validId(monitorId) ||
    typeof checkedAt !== 'string' ||
    !Number.isFinite(Date.parse(checkedAt)) ||
    typeof success !== 'boolean' ||
    (statusCode !== null &&
      (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599)) ||
    (errorLog !== null && typeof errorLog !== 'string') ||
    !monitor ||
    !['name', 'url', 'ownerName'].every((field) => typeof monitor[field] === 'string')
  ) {
    return res.status(400).json({ error: 'Resultado de monitoramento inválido.' });
  }

  const transition = await incidentService.handleStatus(monitorId, { success, errorLog });
  if (transition.stateChanged) {
    await alertService.sendMockEmail(
      monitorId,
      transition.incident.id,
      success ? 'RECUPERACAO' : 'FALHA',
      success ? null : errorLog,
      monitor
    );
  }
  return res.json({
    stateChanged: transition.stateChanged,
    incidentId: transition.incident?.id ?? null,
  });
});

app.use((_req, res) => res.status(404).json({ status: 'fail', message: 'Rota não encontrada.' }));
app.use((error, _req, res, _next) => {
  const status = error.status === 400 || error.status === 413 ? error.status : 500;
  if (status === 500) console.error('Falha no serviço de incidentes:', error.code ?? error.name);
  res
    .status(status)
    .json({ error: status === 500 ? 'Erro interno do servidor.' : 'Corpo JSON inválido.' });
});

export default app;
