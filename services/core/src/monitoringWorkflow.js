import { findAlertRecipient, saveExecution, scheduler } from './modules/monitoring/index.js';
import { sendCheckResult } from './incidentsClient.js';

export async function processCheckResult(monitorId, result) {
  try {
    const execution = await saveExecution(monitorId, result);
    const monitor = await findAlertRecipient(monitorId);
    if (!monitor) return;

    return await sendCheckResult({
      executionId: execution.id,
      checkedAt: execution.timestamp,
      monitorId,
      success: result.success,
      statusCode: result.statusCode,
      errorLog: result.errorLog,
      monitor: { name: monitor.name, url: monitor.url, ownerName: monitor.user.name },
    });
  } catch (error) {
    console.error(`Erro ao processar o resultado do monitor ${monitorId}:`, error.message);
  }
}

export function startMonitoring() {
  scheduler.start(processCheckResult);
}
