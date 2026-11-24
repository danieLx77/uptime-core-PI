export async function sendCheckResult(result) {
  const response = await fetch(new URL('/internal/check-results', process.env.INCIDENTS_URL), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-service-token': process.env.INTERNAL_SERVICE_TOKEN,
    },
    body: JSON.stringify(result),
    signal: AbortSignal.timeout(3000),
    redirect: 'error',
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Incidentes respondeu com HTTP ${response.status}.`);
  }
  if (
    response.status !== 200 ||
    !/^application\/json\b/i.test(response.headers.get('content-type'))
  ) {
    await response.body?.cancel();
    throw new Error('Resposta inválida de Incidentes.');
  }
  const transition = await response.json().catch(() => null);
  const id = transition?.incidentId;
  const validId = typeof id === 'string' && id.trim().length > 0 && id.length <= 80;
  if (
    typeof transition?.stateChanged !== 'boolean' ||
    (!validId && (id !== null || transition.stateChanged))
  ) {
    throw new Error('Resposta inválida de Incidentes.');
  }
  return transition;
}
