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

Prepare três bancos isolados. Interrompa as escritas no D2 para fixar o ponto de corte, produza um snapshot verificado e mantenha os serviços D3 parados até a conferência. Aplique as migrations do D3 nos dois destinos novos e vazios com `npm run db:migrate`.

Use `psql` com papéis dedicados. Cada conexão precisa executar `pg_catalog.pg_control_system()`, inclusive a da origem. Caso o provedor restrinja a função, peça a concessão de `EXECUTE` ao papel de migração ou use uma cópia isolada administrada pela equipe. A origem precisa de leitura. Os destinos precisam de leitura das tabelas e do histórico Prisma, permissão para inserir e adquirir os locks da transferência. Incidentes também precisa de `TEMP`. Use credenciais por conexão e evite URLs com segredos no histórico do shell.

```bash
LEGACY_DATABASE_URL=... CORE_DATABASE_URL=... INCIDENTS_DATABASE_URL=... bash scripts/transfer-d2-data.sh
```

O script compara o identificador do cluster e o OID do banco nas três conexões. Variações da mesma conexão apontam para a mesma identidade. Antes de copiar, ele confirma as tabelas e as colunas usadas, verifica o histórico de migrations e seus checksums e consulta ambos os destinos sem gravar dados. Ele revalida identidade, permissões e destino vazio sob lock antes de cada cópia. Uma cópia física de cluster que conserve a identidade será recusada como possível sobreposição.

A origem é lida sob `REPEATABLE READ READ ONLY`. A transferência preserva IDs, hashes de senhas, datas, incidentes, alertas e relacionamentos. Tokens de recuperação legados são invalidados. Os CSVs ficam em um diretório temporário privado e são removidos ao sair normalmente.

1. Confira o código de saída, as duas confirmações de commit e as contagens do snapshot e dos destinos. Valide amostras de IDs, datas e relacionamentos e confirme a ausência dos tokens legados.
2. Se houver erro, mantenha os serviços parados. O diagnóstico indica a etapa e quais destinos podem ter recebido dados. Uma perda da conexão durante o commit pode deixar seu resultado indeterminado. Consulte ambos os bancos pelo identificador antes de decidir como restaurar.
3. Se algum destino tiver sido gravado, preserve a origem e retorne **os dois destinos novos** ao estado inicial vazio. Restaure os backups prévios ou provisione dois substitutos vazios, reaplique as migrations, atualize as URLs e confira suas identidades. O script não apaga nem recria nenhum banco.
4. Execute a transferência novamente a partir do mesmo snapshot, confira as duas confirmações, os relacionamentos e as consultas administrativas. Só então libere os serviços e conclua o corte do D2.

A CI usa `scripts/check-d2-transfer.sh` com bancos descartáveis para ensaiar destino ocupado, conexões equivalentes, esquema e histórico incompatíveis, falha após o primeiro commit e reexecução bem-sucedida após restauração.

## Contribuição

Use Conventional Commits em português, PRs detalhados e o guard antes de publicar. Mantenha o contexto de negócio dono de sua persistência, atualize o contrato do serviço quando o HTTP mudar e registre decisões arquiteturais em `docs/adr/`.
