# 04 · Matriz de conformidade

**ATENDIDO** indica evidência suficiente para o requisito isolado. **PARCIALMENTE ATENDIDO** indica implementação ou artefato existente com lacuna. **NÃO ATENDIDO** indica ausência de implementação correspondente no material inspecionado. **NÃO VERIFICADO** indica evidência insuficiente para concluir. **NÃO SE APLICA** caberia apenas a requisito condicional e não foi usado. A [validação](01-importacao.md#validação-do-d1) delimita a execução observada.

## Entregáveis por desafio

| Desafio | Requisito | Status | Evidência e próxima ação |
|---|---|---|---|
| D1 | Repositório público na organização da turma | PARCIALMENTE ATENDIDO | GitHub confirmou que o destino é público sob `danieLx77`. Confirmar entrega na organização `gcc267-2026-2` |
| D1 | README | ATENDIDO | `README.md` acadêmico com contexto e instruções iniciais |
| D1 | Licença | ATENDIDO | MIT em `LICENSE` e aviso MIT da origem em `LICENSE.uptime-core-api` |
| D1 | Equipe e papéis | ATENDIDO | `docs/equipe.md` |
| D1 | Visão do produto | ATENDIDO | `docs/visao-produto.md`; revisar transação proposta quando D5 for decidido |
| D1 | ADR inicial | ATENDIDO | `docs/adr/0000-registro-de-decisoes.md` |
| D1 | CI funcional | PARCIALMENTE ATENDIDO | Workflow com geração, lint, migrations e integração em PostgreSQL isolado. Execução remota pendente |
| D1 | PR com descrição | ATENDIDO | [PR #1](https://github.com/danieLx77/uptime-core-PI/pull/1), já integrado |
| D2 | Monólito modular | NÃO ATENDIDO | Monólito com estrutura por camada e Prisma comum; definir interfaces e propriedade dos dados |
| D2 | Pelo menos três contextos delimitados | PARCIALMENTE ATENDIDO | Três responsabilidades distinguíveis em serviços, porém com fronteiras implícitas |
| D2 | Fluxo funcional ponta a ponta | PARCIALMENTE ATENDIDO | Scheduler, checagem, incidente e alerta implementados. Cobertura atual parcial e execução em ambiente isolado pendente |
| D3 | Contratos OpenAPI de dois serviços | PARCIALMENTE ATENDIDO | Gerador único; produzir e verificar dois contratos |
| D3 | Docker Compose | PARCIALMENTE ATENDIDO | Parser aprovou a composição monolítica. Validar a subida da composição distribuída |
| D3 | Serviços independentes | NÃO ATENDIDO | Um entrypoint da aplicação; extrair dois serviços |
| D3 | Database per Service | NÃO ATENDIDO | PostgreSQL de execução compartilhado; separar databases, credenciais e migrations |
| D3 | API Gateway ou BFF | NÃO ATENDIDO | Express concentra rotas do monólito; introduzir entrada que roteie para serviços distintos |
| D4 | Evento publicado via Outbox | NÃO ATENDIDO | Escritas isoladas; persistir evento junto da alteração local |
| D4 | Consumidor idempotente | NÃO ATENDIDO | Chamada em memória; implementar inbox e confirmação posterior ao commit |
| D4 | Broker em funcionamento | NÃO ATENDIDO | Sem broker no Compose e dependências |
| D5 | SAGA completa com compensação | NÃO ATENDIDO | Introduzir ativação compensável após aprovação |
| D5 | Teste que força falha | NÃO ATENDIDO | Testar efeito parcial, compensação e estado final |
| D5 | ADR de coreografia/orquestração | NÃO ATENDIDO | ADR existente institui o processo; decisão da SAGA pendente |
| D6 | Read model alimentado por eventos | NÃO ATENDIDO | Joins diretos no schema de escrita; implementar projeção |
| D7 | Circuit breaker | NÃO ATENDIDO | Tratamento de exceção simples; aplicar em dependência entre serviços |
| D7 | Rastreio ponta a ponta | NÃO ATENDIDO | Sem propagação ou spans HTTP/mensageria |
| D7 | Timeout | PARCIALMENTE ATENDIDO | Axios limita checagem do alvo. Aplicar também aos contratos distribuídos |
| D7 | Retry | NÃO ATENDIDO | Próxima checagem cron é agendamento regular. Implementar política limitada |
| D7 | Correlation ID nos logs | NÃO ATENDIDO | Logs com console e IDs de entidades. Propagar identificador entre HTTP, job e evento |
| D8 | Deploy acadêmico gratuito | NÃO VERIFICADO | Documentação menciona deploy da origem. Confirmar o ambiente acadêmico e publicar após aprovação |
| D8 | README reprodutível | PARCIALMENTE ATENDIDO | Fluxo local documentado. Validar desde clone limpo e complementar para a composição final |
| D8 | Roteiro do caos | PARCIALMENTE ATENDIDO | Cenário preliminar documentado; transformar em roteiro verificável e ensaiado |
| D8 | Gestão segura de segredos | PARCIALMENTE ATENDIDO | dotenv, placeholders e arquivos locais ignorados. Isolar secrets e contexto Docker |
| D8 | Pipeline funcional da aplicação | PARCIALMENTE ATENDIDO | Validações do D1 configuradas. Execução remota e etapa de entrega do D8 pendentes |

## Rubrica arquitetural final

| Requisito | Status | Evidência | Lacuna | Ação necessária | Desafio relacionado |
|---|---|---|---|---|---|
| Pelo menos três Bounded Contexts | PARCIALMENTE ATENDIDO | `src/services/` | Fronteiras e propriedade implícitas | Modularizar Monitoramento, Incidentes e Notificações | D2 |
| Pelo menos dois serviços implantáveis independentemente | NÃO ATENDIDO | `src/server.js`, Dockerfile | API e scheduler no mesmo processo | Empacotar e implantar serviços extraídos isoladamente | D3 |
| Database per Service | NÃO ATENDIDO | `prisma/schema.prisma` | Tabelas operacionais e de identidade no mesmo banco | Dar database, credencial e migrations a cada serviço | D3 |
| Message broker em funcionamento | NÃO ATENDIDO | Compose e lockfile | Broker e clientes ausentes | Incluir broker e validar publicação real | D4 |
| API Gateway ou BFF | NÃO ATENDIDO | `src/app.js` | Entrada atual é a API do monólito | Roteamento de serviços mantendo contrato externo | D3 |
| SAGA completa com compensação | NÃO ATENDIDO | `IncidentService` e `AlertService` | Fluxo direto sem compensação | Implementar ativação e teste de falha | D5 |
| Read model CQRS | NÃO ATENDIDO | Controllers administrativos | Leitura do mesmo modelo transacional | Projetar resumo por monitor consumindo eventos | D6 |
| Outbox transacional | NÃO ATENDIDO | `IncidentService.handleStatus` | Evento não é gravado com a transição | Persistir evento na mesma transação e adicionar relay | D4 |
| Consumidor idempotente | NÃO ATENDIDO | `AlertService.sendMockEmail` | Sem consumo e deduplicação persistente | Inserir inbox única e gravar efeito em transação local | D4 |
| Timeout, retry e Circuit Breaker | PARCIALMENTE ATENDIDO | `PingService.execute` | Timeout no GET monitorado; retry e breaker ausentes | Introduzir políticas verificáveis em chamadas distribuídas | D7 |
| Pipeline de CI verde | PARCIALMENTE ATENDIDO | `ci.yml` com geração, lint, migrations e testes | Novo workflow ainda local | Confirmar a execução após publicação autorizada | D1/D8 |
| ADRs versionados | ATENDIDO | ADR 0000 no HEAD | ADRs das decisões futuras ainda serão escritos | Registrar decisões conforme implementação | D1/D5 |
| Correlation ID em todos os logs | NÃO ATENDIDO | `console` nos serviços | Sem identificador propagado | Instrumentar HTTP, scheduler e broker | D7 |
| README que permite executar o sistema do zero | PARCIALMENTE ATENDIDO | README e guias importados | Validação de clone limpo e instruções finais pendentes | Verificar inicialização completa em ambiente limpo | D8 |

## Ferramentas obrigatórias

| Ferramenta ou prática | Status | Configuração no código | Confirmação externa ou ação pendente |
|---|---|---|---|
| GitHub | ATENDIDO | Remote do destino | Repositório pessoal público confirmado. A organização da turma é avaliada no D1 |
| GitHub Projects | NÃO VERIFICADO | Kanban previsto em `docs/equipe.md` | Quadro e vínculos com issues não confirmados |
| GitHub Actions | PARCIALMENTE ATENDIDO | CI da API em `.github/workflows/ci.yml` | Execução anterior de documentação confirmada. Aguardar execução do workflow atual |
| SonarCloud | NÃO ATENDIDO | Configuração da origem identificada e excluída da importação | Projeto/credenciais acadêmicos não confirmados. Configurar no repositório autorizado |
| Docker | PARCIALMENTE ATENDIDO | Dockerfile Node 24 | CLI presente. Build não executado por bloqueio no socket |
| Docker Compose | PARCIALMENTE ATENDIDO | Composição com API e PostgreSQL | Parser aprovou; execução e topologia final pendentes |
| PR com revisão obrigatória | NÃO VERIFICADO | Previsto em `docs/equipe.md` | PR #1 confirmado. Regra efetiva de revisão/proteção não confirmada |
| RabbitMQ, Kafka ou Redis Streams | NÃO ATENDIDO | Sem configuração | RabbitMQ é candidato para D4 |
| Um banco por serviço | NÃO ATENDIDO | Schema de execução único | Definir bancos e usuários separados no D3 |

## Contagens

| Matriz | Atendidos | Parciais | Ausentes | Não verificados | Não se aplica | Total |
|---|---:|---:|---:|---:|---:|---:|
| Entregáveis por desafio | 6 | 11 | 15 | 1 | 0 | 33 |
| Rubrica arquitetural final | 1 | 4 | 9 | 0 | 0 | 14 |
| Ferramentas obrigatórias | 1 | 3 | 3 | 2 | 0 | 9 |

As contagens usam o número de linhas de cada matriz. Um requisito pode reaparecer em matrizes diferentes. O total de uma matriz não mede o esforço restante.
