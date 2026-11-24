import 'dotenv/config';
import express from 'express';
import spec from '../openapi/openapi.json' with { type: 'json' };
import { requireService } from './serviceAuth.js';
import { globalErrorHandler } from './middlewares/errorMiddleware.js';
import adminRoutes from './routes/adminRoutes.js';
import { authenticate, authRoutes, userRoutes } from './modules/identity/index.js';
import { findMonitorSummaries, monitorRoutes } from './modules/monitoring/index.js';
import AppError from './utils/AppError.js';

const app = express();

// Blindagem de Cabeçalho (Remove o X-Powered-By)
app.disable('x-powered-by');

app.use(express.json());
app.get('/api/openapi.json', (_req, res) => res.json(spec));

const apiPresentation = {
  status: 'ok',
  name: 'UptimeCore API',
  version: '1.0.0',
  description: 'API de monitoramento de disponibilidade e tempo de resposta',
  documentation: '/api/docs',
  endpoints: {
    health: '/api/health',
    auth: '/api/auth',
    users: '/api/users',
    monitors: '/api/monitors',
    admin: '/api/admin',
  },
};

// Rotas de apresentação da API
app.get(['/', '/api'], (req, res) => {
  return res.status(200).json(apiPresentation);
});

// Rota de Health Check (Crítica para a Infraestrutura)
app.get('/api/health', (req, res) => {
  const saoPauloTimestamp = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(new Date())
    .replace(' ', 'T');

  return res.status(200).json({
    status: 'ok',
    timestamp: `${saoPauloTimestamp}-03:00`,
  });
});

// Rotas de Autenticação (Públicas)
app.use('/api/auth', authRoutes);

// Rotas de domínio protegidas por JWT
app.use('/api/users', userRoutes);
app.use('/api/monitors', authenticate, monitorRoutes);

// Rotas Administrativas (Protegidas por JWT + Admin Middleware)
app.use('/api/admin', adminRoutes);

app.post('/internal/monitors/query', requireService, async (req, res) => {
  const { ids } = req.body || {};
  if (
    !Array.isArray(ids) ||
    ids.length > 500 ||
    ids.some((id) => typeof id !== 'string' || !id || id.length > 80)
  ) {
    return res.status(400).json({ error: 'Informe até 500 identificadores de monitor.' });
  }
  return res.json(await findMonitorSummaries(ids));
});

// Tratamento para rotas que não existem (404)
app.use((req, res, next) => {
  next(new AppError(`A rota ${req.originalUrl} não foi encontrada neste servidor.`, 404));
});

// O Middleware Global de Erro
app.use(globalErrorHandler);

export default app;
