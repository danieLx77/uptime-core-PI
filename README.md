# uptime-core-PI
Projeto da disciplina de Projeto Integrador I da Universidade Federal de Lavras.

API de monitoramento HTTP com cadastro de monitores, checagens agendadas, histórico de execuções e incidentes. A base importada usa Node.js 24, Express, Prisma e PostgreSQL. A atribuição original está em [LICENSE.uptime-core-api](LICENSE.uptime-core-api).

- [Visão do produto](docs/visao-produto.md)
- [Equipe](docs/equipe.md)
- [ADR 0000 — Registro de decisões de arquitetura](docs/adr/0000-registro-de-decisoes.md)

## Ambiente de desenvolvimento

Use Node.js 24, npm e um PostgreSQL dedicado ao Uptime Core PI. Se usar Docker para o banco, confira se a porta `5432` e o nome de contêiner do [Compose](docker-compose.yml) estão livres.

```bash
docker compose up -d --wait postgres_db
cp -n .env.example .env
HUSKY=0 npm ci
```

Para executar a API no host, ajuste `DATABASE_URL` em `.env` para `postgresql://admin:admin123@127.0.0.1:5432/api_monitor_db?schema=public` se estiver usando o banco local acima. Defina um `JWT_SECRET` próprio. Configure SMTP próprio ou um capturador local se for testar a recuperação de senha.

```bash
npm exec -- prisma generate
npm run db:migrate
npm run swagger
npm start
```

Por padrão, a API responde em `http://localhost:3000/api/health`. A interface Swagger fica em `http://localhost:3000/api/docs`. Escolha o servidor local na interface.

## Testes de integração

Use um banco descartável separado do banco da API. Os testes apagam registros do banco configurado. O serviço `postgres_test` usa a porta `5433` e um volume separado no Compose.

```bash
docker compose up -d --wait postgres_test
```

Crie `.env.test` com uma `DATABASE_URL` que aponte para o banco descartável e confirme o destino antes de executar a suíte. Para o serviço `postgres_test` acima, use estes valores estritamente locais.

```dotenv
DATABASE_URL=postgresql://admin:admin@127.0.0.1:5433/api_monitor_test_db?schema=public
JWT_SECRET=uptime-local-test-signing-key
```

```bash
npm exec -- prisma generate
npm run swagger
npm run lint
env -u DATABASE_URL npm run test:db-setup
env -u DATABASE_URL npm test -- --coverage
```

A [CI da API](.github/workflows/ci.yml) roda em PRs para `main` e em pushes para `main` e `desafio-01`. Ela usa Node.js 24 e um PostgreSQL descartável próprio do job para aplicar migrations e rodar os testes com cobertura.

A documentação de [API](docs/api.md), [desenvolvimento](docs/development.md) e [operação](docs/operations.md) foi importada da origem e inclui referências históricas ao GitHub, SonarCloud e Render originais. Para o ambiente acadêmico, siga os comandos acima.
