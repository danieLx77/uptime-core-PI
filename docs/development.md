# Desenvolvimento do Uptime Core PI

Use Node.js 24, npm e Docker Compose v2. O [README](../README.md) explica o setup padrão e a suíte. Os workspaces dividem as dependências e comandos por unidade, com um lockfile compartilhado no repositório.

| Comando | O que executa |
|---|---|
| `npm run db:validate`, `npm run db:generate` | Valida schemas e gera os dois clientes isolados |
| `npm run db:migrate` | Aplica as migrations nos dois bancos configurados nas variáveis de ambiente |
| `npm run test:db-setup` | Usa `.env.test` e aplica migrations nos bancos descartáveis |
| `npm run test:architecture` | Confere imports, reexports e fronteiras estáticas |
| `npm run test:contracts` | Compara rotas, autenticação interna e referências com os contratos |
| `npm test -- --coverage` | Executa Jest serialmente com os dois PostgreSQL descartáveis |
| `npm run lint` | Analisa código dos serviços e Gateway, excluindo clientes gerados |

## Executar processos separadamente

Para executar no host, exporte as variáveis requeridas pelo processo antes de iniciá-lo. Use PostgreSQL com credencial própria por serviço. Para migrar ou iniciar um único workspace:

```bash
npm run db:generate -w @uptime/core
npm run db:migrate -w @uptime/core
PORT=3001 npm run start -w @uptime/core
```

Incidentes usa `-w @uptime/incidents` e porta 3002. O Gateway usa `-w @uptime/gateway` e porta 3000. Para habilitar a comunicação no host, aponte `CORE_URL` e `INCIDENTS_URL` para as origens locais correspondentes.

| Variável | Consumidores |
|---|---|
| `CORE_DATABASE_URL` | Núcleo e seu Prisma |
| `INCIDENTS_DATABASE_URL` | Incidentes e seu Prisma |
| `CORE_URL` | Gateway e cliente de composição de Incidentes |
| `INCIDENTS_URL` | Gateway e cliente de ingestão do Núcleo |
| `JWT_SECRET` | Assinatura no Núcleo e verificação local nos dois serviços |
| `INTERNAL_SERVICE_TOKEN` | Autenticação dos endpoints internos de Núcleo e Incidentes |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS` | Recuperação de senha no Núcleo |
| `ALLOWED_ORIGINS` | Lista de origens separadas por vírgula no Gateway |
| `MONITORING_TEST_ORIGIN` | Fixture de origem HTTP de loopback com porta explícita, somente sob `NODE_ENV=test` |

## Transferir dados do D2

As migrations históricas em `prisma/` ficam disponíveis como referência. Faça a transferência de um **snapshot verificado** do monólito com os serviços de destino parados. Use três bancos isolados, gere backup da origem e confira as URLs. Crie e migre os destinos com `npm run db:migrate`. O script usa o cliente `psql`.

```bash
LEGACY_DATABASE_URL=... CORE_DATABASE_URL=... INCIDENTS_DATABASE_URL=... bash scripts/transfer-d2-data.sh
```

A origem é lida em snapshot de repetição de leitura. Cada destino deve estar vazio e recebe uma transação própria. O script preserva IDs, senhas com hash, datas, incidentes, alertas e referências externas. Tokens de recuperação antigos são descartados e precisam ser solicitados novamente. Confira as contagens de exportação e destino que o `psql` exibe, e verifique as referências e consultas antes de liberar os serviços.

Os dois commits de destino podem ocorrer em momentos diferentes. Se o segundo falhar, mantenha os serviços parados, preserve a origem e descarte ou restaure apenas os destinos novos conforme o plano operacional aprovado. O script recusa duplicidade de incidente aberto no snapshot e exige revisão manual. Os CSVs temporários incluem dados sensíveis e saem da máquina somente se o operador deliberadamente os copiar. Execute com permissões restritas e evite URLs com credenciais escritas no histórico do shell.

## Contribuição

Use Conventional Commits em português, PRs detalhados e o guard antes de publicar. Mantenha o contexto de negócio dono de sua persistência, atualize o contrato do serviço quando o HTTP mudar e registre decisões arquiteturais em `docs/adr/`.
