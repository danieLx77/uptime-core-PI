import { jest } from '@jest/globals';
import scheduler from '../../services/core/src/modules/monitoring/SchedulerService.js';

test('cron evita sobreposição de ciclo demorado, registra descarte e continua no minuto seguinte', async () => {
  jest.useFakeTimers({ now: new Date('2026-01-01T12:00:00Z') });
  const info = jest.spyOn(console, 'info').mockImplementation(() => {});
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { promise, resolve } = Promise.withResolvers();
  const cycle = jest.spyOn(scheduler, 'runCycle').mockReturnValueOnce(promise).mockResolvedValue();
  const processResult = jest.fn();
  const task = scheduler.start(processResult);
  try {
    await jest.advanceTimersByTimeAsync(60_010);
    expect(cycle).toHaveBeenCalledTimes(1);
    expect(cycle).toHaveBeenCalledWith(processResult);
    expect(info).toHaveBeenCalledWith('[CRON] Ciclo de monitoramento iniciado.');

    await jest.advanceTimersByTimeAsync(60_000);
    expect(cycle).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[CRON] Tick descartado por sobreposição.', {
      scheduledAt: '2026-01-01T12:02:00.000Z',
    });
    resolve();
    await jest.advanceTimersByTimeAsync(0);
    expect(info).toHaveBeenCalledWith('[CRON] Ciclo de monitoramento encerrado.', {
      durationMs: expect.any(Number),
    });
    const completion = info.mock.calls.find(([message]) => message.includes('encerrado'));
    expect(completion[1].durationMs).toBeGreaterThanOrEqual(60_000);

    await jest.advanceTimersByTimeAsync(60_000);
    expect(cycle).toHaveBeenCalledTimes(2);
  } finally {
    task.destroy();
    jest.restoreAllMocks();
    jest.useRealTimers();
  }
});
