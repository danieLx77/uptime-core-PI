import { once } from 'node:events';
import { createServer } from 'node:http';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import cron from 'node-cron';
import request from 'supertest';
import app from '../support/gateway.js';
import prisma from '../support/database.js';
import { startMonitoring } from '../../services/core/src/monitoringWorkflow.js';

describe('Fluxo integrado de monitoramento, incidentes e notificações', () => {
  let target;
  let targetUrl;
  let targetStatus = 200;
  let requestsToTarget = 0;
  const originalTestOrigin = process.env.MONITORING_TEST_ORIGIN;

  beforeAll(async () => {
    // O scheduler consulta todo o banco de testes. A limpeza impede chamadas a alvos de outras suítes.
    await prisma.alert.deleteMany();
    await prisma.incident.deleteMany();
    await prisma.user.deleteMany();

    target = createServer((_req, res) => {
      requestsToTarget += 1;
      res.writeHead(targetStatus).end();
    });
    target.listen(0, '127.0.0.1');
    await once(target, 'listening');
    targetUrl = `http://127.0.0.1:${target.address().port}/health`;
    process.env.MONITORING_TEST_ORIGIN = new URL(targetUrl).origin;
  });

  afterAll(async () => {
    if (originalTestOrigin === undefined) delete process.env.MONITORING_TEST_ORIGIN;
    else process.env.MONITORING_TEST_ORIGIN = originalTestOrigin;
    if (target?.listening) {
      await new Promise((resolve, reject) => {
        target.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await prisma.$disconnect();
  });

  it('registra sucesso, falha, repetição e recuperação pelo callback do cron', async () => {
    const name = 'Operador do fluxo D2';
    const email = 'operador-d2@example.test';
    const password = 'senha-descartavel-d2';
    const { body: user } = await request(app)
      .post('/api/auth/register')
      .send({ name, email, password })
      .expect(201);
    const { body: session } = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    const userAuth = `Bearer ${session.token}`;

    const { body: monitor } = await request(app)
      .post('/api/monitors')
      .set('Authorization', userAuth)
      .send({ name: 'Alvo HTTP controlado', url: targetUrl, interval_minutes: 5 })
      .expect(201);

    const admin = await prisma.user.create({
      data: {
        name: 'Administrador D2',
        email: 'admin-d2@example.test',
        password_hash: 'fixture',
        role: 'ADMIN',
      },
    });
    const adminAuth = `Bearer ${jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET)}`;

    async function list(resource) {
      const response = await request(app)
        .get(`/api/admin/${resource}`)
        .query({ monitorId: monitor.id })
        .set('Authorization', adminAuth)
        .expect(200);
      return response.body;
    }

    await request(app).get('/api/admin/incidents').set('Authorization', userAuth).expect(403);

    const schedule = jest.spyOn(cron, 'schedule').mockImplementation(() => undefined);
    let scheduledTick;
    try {
      startMonitoring();
      expect(schedule).toHaveBeenCalledTimes(1);
      expect(schedule).toHaveBeenCalledWith('* * * * *', expect.any(Function), { noOverlap: true });
      [[, scheduledTick]] = schedule.mock.calls;
    } finally {
      schedule.mockRestore();
    }

    function tickAt(minute) {
      const clock = jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(minute);
      try {
        return scheduledTick();
      } finally {
        clock.mockRestore();
      }
    }

    await tickAt(1);
    expect(requestsToTarget).toBe(0);

    await tickAt(5);
    expect(await list('incidents')).toEqual([]);
    expect(await list('alerts')).toEqual([]);

    targetStatus = 503;
    await tickAt(10);
    const opened = await list('incidents');
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({
      monitorId: monitor.id,
      status: 'OPEN',
      resolvedAt: null,
      errorLog: 'HTTP Error 503',
    });

    const firstAlerts = await list('alerts');
    expect(firstAlerts).toHaveLength(1);
    expect(firstAlerts[0]).toMatchObject({
      monitorId: monitor.id,
      incidentId: opened[0].id,
      type: 'EMAIL',
      message: expect.stringContaining('[ALERTA CRÍTICO]'),
    });

    await tickAt(15);
    expect((await list('incidents')).map(({ id }) => id)).toEqual([opened[0].id]);
    expect((await list('alerts')).map(({ id }) => id)).toEqual([firstAlerts[0].id]);

    targetStatus = 200;
    await tickAt(20);
    const resolved = await list('incidents');
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({
      id: opened[0].id,
      status: 'RESOLVED',
      resolvedAt: expect.any(String),
    });
    const alerts = await list('alerts');
    expect(alerts).toHaveLength(2);
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          incidentId: opened[0].id,
          message: expect.stringContaining('[RECUPERAÇÃO]'),
        }),
      ])
    );

    const executions = await list('check-executions');
    expect(executions.map(({ status_code }) => status_code).sort()).toEqual([200, 200, 503, 503]);
    expect(requestsToTarget).toBe(4);
    expect(monitor.userId).toBe(user.id);
  });
});
