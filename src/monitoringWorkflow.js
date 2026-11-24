import { incidentService } from './modules/incidents/index.js';
import { findAlertRecipient, saveExecution, scheduler } from './modules/monitoring/index.js';
import { alertService } from './modules/notifications/index.js';

export async function processCheckResult(monitorId, result) {
  try {
    await saveExecution(monitorId, result);
    const transition = await incidentService.handleStatus(monitorId, result);

    if (transition.stateChanged) {
      await alertService.sendMockEmail(
        monitorId,
        transition.incident.id,
        result.success ? 'RECUPERACAO' : 'FALHA',
        result.success ? null : result.errorLog,
        findAlertRecipient
      );
    }

    return transition;
  } catch (error) {
    console.error(`Erro ao processar o resultado do monitor ${monitorId}:`, error);
  }
}

export function startMonitoring() {
  scheduler.start(processCheckResult);
}
