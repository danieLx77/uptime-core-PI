# Vitrine do D3 · Seis minutos

Antes da apresentação, configure `.env` a partir do exemplo, gere segredos distintos e rode `docker compose up --build --wait` em uma composição de demonstração. Prepare os bancos de teste descartáveis e `.env.test` conforme o [README](../README.md#testes).

| Tempo | Demonstração |
|---|---|
| 0:00–1:10 | Mostrar `docker compose ps`, os cinco componentes, a porta pública e as redes de dados |
| 1:10–2:00 | Abrir Swagger em `/api/docs/`, alternar entre Núcleo e Incidentes e indicar chamadas internas |
| 2:00–4:15 | Rodar o teste abaixo. Mostrar cadastro e login pelo Gateway, alvo controlado, falha repetida, recuperação e as consultas autorizadas |
| 4:15–5:10 | Rodar os casos concorrentes, explicar o índice parcial e apontar os dois schemas |
| 5:10–6:00 | Mostrar ADR 0002 e CI, explicar o registro local preservado se Incidentes ficar indisponível |

```bash
node scripts/smoke-compose.mjs
npm test -- --runTestsByPath tests/integration/monitoringWorkflow.test.js tests/integration/incidentConcurrency.test.js
```

O teste usa HTTP de loopback controlado e dispensa SMTP ou serviço público. A saída esperada mostra um incidente aberto e depois resolvido, dois alertas simulados e quatro execuções.
