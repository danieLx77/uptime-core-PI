export async function attachMonitors(records) {
  const ids = [...new Set(records.map((record) => record.monitorId))];
  const byId = new Map();

  for (let offset = 0; offset < ids.length; offset += 500) {
    const batch = ids.slice(offset, offset + 500);
    const requested = new Set(batch);
    try {
      const response = await fetch(new URL('/internal/monitors/query', process.env.CORE_URL), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-service-token': process.env.INTERNAL_SERVICE_TOKEN,
        },
        body: JSON.stringify({ ids: batch }),
        signal: AbortSignal.timeout(3000),
        redirect: 'error',
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new CoreUnavailable();
      }
      if (
        response.status !== 200 ||
        !/^application\/json\b/i.test(response.headers.get('content-type'))
      ) {
        await response.body?.cancel();
        throw new Error('Formato da resposta de projeções inválido.');
      }
      const monitors = await response.json();
      if (!Array.isArray(monitors)) throw new Error('Projeções de monitor inválidas.');
      for (const monitor of monitors) {
        if (!validMonitor(monitor) || !requested.delete(monitor.id)) {
          throw new Error('Projeção de monitor inválida, repetida ou não solicitada.');
        }
        byId.set(monitor.id, monitor);
      }
    } catch (cause) {
      throw new CoreUnavailable('Núcleo indisponível.', { cause });
    }
  }

  return records.map((record) => ({ ...record, monitor: byId.get(record.monitorId) ?? null }));
}

function validId(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 80;
}

function validMonitor(monitor) {
  return (
    validId(monitor?.id) &&
    validId(monitor.userId) &&
    typeof monitor.name === 'string' &&
    typeof monitor.url === 'string' &&
    ['ACTIVE', 'PAUSED'].includes(monitor.status)
  );
}

class CoreUnavailable extends Error {
  status = 503;
}
