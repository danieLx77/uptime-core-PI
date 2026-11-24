# Vitrine do D2 · Seis minutos

## Preparação antes da apresentação

Em um clone limpo, prepare primeiro o banco de desenvolvimento da API. Copie `.env.example` para `.env` se o arquivo ainda não existir. Ajuste `DATABASE_URL` para o banco de desenvolvimento no host e defina um `JWT_SECRET` local conforme o [README](../README.md#ambiente-de-desenvolvimento).

```bash
docker compose config --quiet
docker compose up -d --wait postgres_db
HUSKY=0 npm ci
npm exec -- prisma generate
npm run swagger
env -u DATABASE_URL npm run db:migrate
```

Para o teste da vitrine, configure `.env.test` separadamente conforme o [README](../README.md#testes-de-integração). Confirme que a URL aponta para o banco descartável na porta 5433. A suíte remove registros desse banco.

```bash
docker compose up -d --wait postgres_test
env -u DATABASE_URL npm run test:db-setup
```

Para mostrar a aplicação em execução, inicialize o servidor com `npm start` usando a configuração do banco de desenvolvimento separada do banco descartável. Abra `http://localhost:3000/api/health` e `http://localhost:3000/api/docs`. No teste ponta a ponta, o Express e o alvo sintético são iniciados no próprio processo de testes.

## Roteiro

| Tempo | Demonstração |
|---|---|
| 0:00–0:45 | Mostre health e Swagger. Explique que API e scheduler rodam no mesmo processo e usam um banco de execução |
| 0:45–2:00 | Abra o [mapa de contextos](architecture.md#c4--componentes-e-mapa-de-contextos), mostre os pontos públicos em `src/modules/*/index.js` e a composição em `src/monitoringWorkflow.js` |
| 2:00–4:00 | Rode o comando de integração abaixo. Mostre no teste o callback registrado no cron e a sequência 200, 503, 503, 200 e as verificações das consultas administrativas. Destaque uma ocorrência e dois alertas |
| 4:00–5:00 | Rode `npm run test:architecture`. Abra `scripts/architecture/self-check.mjs` e mostre o caso que rejeita import privado e as duas arestas de um ciclo |
| 5:00–6:00 | Explique o [ADR 0001](adr/0001-monolito-modular.md). O desafio de separar escritas sem alterar as consultas foi tratado mantendo as projeções Prisma de leitura existentes |

```bash
env -u DATABASE_URL npm test -- --runTestsByPath tests/integration/monitoringWorkflow.test.js
npm run test:architecture
```

O verificador arquitetural e a configuração do Compose foram executados localmente. A sequência com PostgreSQL e servidor HTTP passou na CI. Antes da apresentação, ensaie o roteiro completo no computador da equipe. O teste usa um alvo local. O SMTP fica fora da demonstração.
