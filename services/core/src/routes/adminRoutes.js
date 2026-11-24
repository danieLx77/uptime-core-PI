import { Router } from 'express';
import { authenticate, countUsers, requireAdmin } from '../modules/identity/index.js';
import { adminRoutes as monitoringRoutes, countMonitors } from '../modules/monitoring/index.js';

const routes = new Router();

// Todas as rotas administrativas exigem login E ser admin
routes.use(authenticate);
routes.use(requireAdmin);

// Exemplo de rota restrita: Status geral do sistema (GET /api/admin/status)
routes.get('/status', async (req, res) => {
  try {
    const totalUsers = await countUsers();
    const totalMonitors = await countMonitors();

    return res.json({
      system: 'UptimeCore',
      metrics: {
        users: totalUsers,
        monitors: totalMonitors,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    return res.status(500).json({ error: 'Erro ao buscar métricas.' });
  }
});

routes.use(monitoringRoutes);

export default routes;
