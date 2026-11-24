import cron from 'node-cron';
import PingService from './PingService.js';
import { DestinationBlocked } from './destinationPolicy.js';
import prisma from './persistence.js';

class SchedulerService {
  start(processResult) {
    const task = cron.schedule(
      '* * * * *',
      async () => {
        const started = performance.now();
        console.info('[CRON] Ciclo de monitoramento iniciado.');
        try {
          await this.runCycle(processResult);
        } finally {
          console.info('[CRON] Ciclo de monitoramento encerrado.', {
            durationMs: Math.round(performance.now() - started),
          });
        }
      },
      { noOverlap: true }
    );
    task.on('execution:overlap', ({ date }) => {
      console.warn('[CRON] Tick descartado por sobreposição.', { scheduledAt: date.toISOString() });
    });
    task.on('execution:missed', () => {
      console.warn('[CRON] O agendador detectou um tick perdido.');
    });
    console.log('⏰ Scheduler de Monitoramento iniciado.');
    return task;
  }

  async runCycle(processResult) {
    try {
      const currentMinute = new Date().getMinutes();
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
          if (error instanceof DestinationBlocked) {
            console.warn(
              `[CRON] Checagem bloqueada pela política de rede para o monitor ${monitor.id}.`
            );
            continue;
          }
          console.error(`Falha isolada ao processar monitor ${monitor.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Erro crítico no ciclo do Scheduler:', error);
    }
  }
}

export default new SchedulerService();
