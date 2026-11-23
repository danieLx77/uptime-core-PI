import cron from 'node-cron';
import PingService from './PingService.js';
import prisma from './persistence.js';

class SchedulerService {
  start(processResult) {
    console.log('⏰ Scheduler de Monitoramento iniciado.');
    cron.schedule('* * * * *', () => this.runCycle(processResult));
  }

  async runCycle(processResult, currentMinute = new Date().getMinutes()) {
    try {
      const activeMonitors = await prisma.monitor.findMany({ where: { status: 'ACTIVE' } });
      const monitorsToRun = activeMonitors.filter(
        (monitor) => currentMinute % monitor.interval_minutes === 0
      );

      if (monitorsToRun.length === 0) return;

      console.log(`[CRON] Executando ping para ${monitorsToRun.length} monitor(es)...`);

      for (const monitor of monitorsToRun) {
        try {
          const result = await PingService.execute(monitor.url);
          await processResult(monitor.id, result);
        } catch (error) {
          console.error(`Falha isolada ao processar monitor ${monitor.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Erro crítico no ciclo do Scheduler:', error);
    }
  }
}

export default new SchedulerService();
