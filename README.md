# Uptime Core PI

Projeto de monitoramento HTTP da disciplina Projeto Integrador I da Universidade Federal de Lavras. Usuários cadastram monitores. O Núcleo verifica o alvo e persiste o resultado. Incidentes acompanha indisponibilidade e registra alertas simulados. O Gateway fornece a entrada pública.

- [Visão do produto](docs/visao-produto.md)
- [Equipe](docs/equipe.md)
- [Arquitetura e conformidade do D3](docs/architecture.md)
- [Guia de desenvolvimento](docs/development.md)
- [Roteiro da vitrine](docs/vitrine-d3.md)
- [ADR 0002 · Decomposição em dois serviços](docs/adr/0002-decomposicao-d3.md)
- [Licença e atribuição da API original](LICENSE.uptime-core-api)

## Executar com Docker Compose

Requisitos: Docker com Compose v2. Para executar verificações fora dos contêineres, use Node.js 24 e npm.

Copie `.env.example` para `.env` se precisar criar a configuração. Defina **dois valores aleatórios distintos** em `JWT_SECRET` e `INTERNAL_SERVICE_TOKEN`. Use credenciais separadas para os dois bancos. Os valores de banco do exemplo servem ao ambiente local. Ative SMTP no Núcleo apenas para usar recuperação de senha pelo canal real.

```bash
cp -n .env.example .env
docker compose up --build --wait
node scripts/smoke-compose.mjs
```

O smoke cria e remove um usuário e um monitor de teste. Use-o em uma composição descartável. Se alterar a porta padrão, configure `GATEWAY_URL` para o smoke.

| Entrada pelo Gateway | Caminho |
|---|---|
| Apresentação da API | `http://localhost:3000/api` |
| Health do Núcleo | `http://localhost:3000/api/health` |
| Health do Gateway | `http://localhost:3000/gateway/health` |
| Swagger UI | `http://localhost:3000/api/docs/` |
| Contratos JSON | `/api/docs/core.json`, `/api/docs/incidents.json` |

Compose executa as migrations de cada serviço durante a inicialização. Os bancos e serviços de aplicação usam portas internas. Só o Gateway publica uma porta. Para validar a inicialização independente, execute `docker compose up -d --build --wait core` ou `docker compose up -d --build --wait incidents` em um projeto Compose isolado.

## Testes

Em `.env.test`, configure `CORE_DATABASE_URL` e `INCIDENTS_DATABASE_URL` para bancos **descartáveis e distintos** e defina chaves exclusivas de teste para `JWT_SECRET` e `INTERNAL_SERVICE_TOKEN`. O override de teste mapeia os PostgreSQL para `127.0.0.1:55431` e `:55432`. As suítes removem fixtures dos bancos configurados.

```bash
docker compose -p uptime_d3_test -f docker-compose.yml -f compose.test.yaml up -d --wait core-db incidents-db
HUSKY=0 npm ci
npm run db:validate
npm run db:generate
npm run test:db-setup
npm run lint
npm run test:architecture
npm run test:contracts
npm test -- --coverage
```

O [guia de desenvolvimento](docs/development.md) lista as variáveis, a execução individual e o procedimento de transferência dos dados do D2. Consulte [Arquitetura](docs/architecture.md) para conhecer as garantias de concorrência, a política de checagem HTTP e as falhas parciais esperadas.
