# Vitrine do D3 · Seis minutos

Prepare antes uma composição descartável e os bancos de testes descartáveis com `.env.test`, seguindo o [README](../README.md#testes). Use uma porta livre para a vitrine e gere os segredos de demonstração.

```bash
export COMPOSE_PROJECT_NAME=uptime_d3_vitrine
export GATEWAY_PORT=3300
export GATEWAY_URL=http://127.0.0.1:3300
docker compose up -d --build --wait
```

| Tempo | Demonstração |
|---|---|
| 0:00–1:00 | Mostrar `docker compose ps`, os cinco componentes, a porta pública e as redes de dados. |
| 1:00–1:45 | Abrir `/api/docs/` no Gateway e alternar entre os dois contratos. |
| 1:45–3:40 | Rodar o teste do fluxo distribuído. Mostrar as quatro execuções, um incidente e dois alertas. |
| 3:40–5:40 | Rodar a interrupção e recuperação de Incidentes. Mostrar os códigos e a preservação do registro. |
| 5:40–6:00 | Apontar o ADR 0002, o índice único parcial e a execução da CI. |

```bash
npm test -- --runTestsByPath tests/integration/monitoringWorkflow.test.js
node scripts/smoke-compose.mjs --incidents-recovery
```

O teste do fluxo usa HTTP de loopback controlado e dispensa SMTP. O smoke usa um monitor pausado, um incidente de demonstração e dois logins do mesmo usuário descartável, antes e depois de receber a role `ADMIN`. O script limpa as fixtures ao final.

| Etapa da recuperação | Comportamento esperado |
|---|---|
| Antes da interrupção | `GET /api/admin/incidents?monitorId=<id>` retorna `200` com o incidente de demonstração e sua projeção do monitor. |
| `docker compose stop -t 3 incidents` | A mesma consulta autenticada retorna `502` se a conexão falhar ou `504` se o Gateway atingir seu prazo de oito segundos. |
| Incidentes parado | `GET /api/health` e `GET /api/monitors/<id>` no Gateway retornam `200`. |
| `docker compose up -d --wait --wait-timeout 45 incidents` | O script espera o health do serviço. A consulta administrativa retorna `200` com o mesmo incidente e a mesma projeção do monitor. |
