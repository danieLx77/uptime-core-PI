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
  const resultBody = await response.json();
  if (typeof resultBody?.stateChanged !== 'boolean') {
    throw new Error('Resposta inválida de Incidentes.');
  }
  return resultBody;
}
