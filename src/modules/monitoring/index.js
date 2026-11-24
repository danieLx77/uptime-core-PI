import { Router } from 'express';
import AdminCheckExecutionController from './AdminCheckExecutionController.js';
import prisma from './persistence.js';

export { default as monitorRoutes } from './monitorRoutes.js';
export { default as scheduler } from './SchedulerService.js';

export const adminRoutes = Router();
adminRoutes.get('/check-executions', AdminCheckExecutionController.index);
adminRoutes.get('/check-executions/:id', AdminCheckExecutionController.show);
adminRoutes.delete('/check-executions/:id', AdminCheckExecutionController.delete);

export function countMonitors() {
  return prisma.monitor.count();
}

export function saveExecution(monitorId, { statusCode, responseTimeMs }) {
  return prisma.checkExecution.create({
    data: { monitorId, status_code: statusCode, response_time_ms: responseTimeMs },
  });
}

export function findAlertRecipient(monitorId) {
  return prisma.monitor.findUnique({
    where: { id: monitorId },
    select: { name: true, url: true, user: { select: { name: true, email: true } } },
  });
}
