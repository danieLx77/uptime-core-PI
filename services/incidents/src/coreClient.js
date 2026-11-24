export async function attachMonitors(records) {
  const ids = [...new Set(records.map((record) => record.monitorId))];
  const byId = new Map();

  for (let offset = 0; offset < ids.length; offset += 500) {
    try {
      const response = await fetch(new URL('/internal/monitors/query', process.env.CORE_URL), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-service-token': process.env.INTERNAL_SERVICE_TOKEN,
        },
        body: JSON.stringify({ ids: ids.slice(offset, offset + 500) }),
        signal: AbortSignal.timeout(3000),
        redirect: 'error',
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new CoreUnavailable();
      }
      for (const monitor of await response.json()) byId.set(monitor.id, monitor);
    } catch (cause) {
      throw new CoreUnavailable('Núcleo indisponível.', { cause });
    }
  }

  return records.map((record) => ({ ...record, monitor: byId.get(record.monitorId) ?? null }));
}

class CoreUnavailable extends Error {
  status = 503;
}
