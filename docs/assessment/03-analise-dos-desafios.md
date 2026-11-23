# 03 · Análise dos desafios

Os requisitos seguem a [fonte acadêmica](README.md) e a rubrica final. Os status seguem a [matriz](04-matriz-de-conformidade.md). A inspeção indica o que está implementado. A [validação](01-importacao.md#validações) registra separadamente o que foi executado.

## D1 · Fundação do projeto

**Objetivo e requisitos.** Repositório público na organização da turma, README, licença, `docs/equipe.md`, `docs/visao-produto.md`, ADR inicial, CI funcional e PR com descrição.

| Estado | Evidência e encaminhamento |
|---|---|
| Aproveitar integralmente | `LICENSE`, atribuição MIT da base, `docs/equipe.md` com integrantes/papéis/processo, `docs/visao-produto.md` com problema/público/fluxo e `docs/adr/0000-registro-de-decisoes.md` |
| Aproveitar com adaptação | README acadêmico complementado na importação. `.github/workflows/ci.yml` agora configura instalação com lockfile, geração de Prisma Client e Swagger, lint, migrations e testes com PostgreSQL isolado |
| Lacunas de processo | [Repositório verificado](https://github.com/danieLx77/uptime-core-PI) é público e pertence à conta pessoal `danieLx77`. Confirmar a entrega na organização `gcc267-2026-2`. A visão atual identifica um fluxo transversal, mas a equipe deve atualizar a transação proposta para o D5 se aprovar outra SAGA |
| Verificação | [PR #1](https://github.com/danieLx77/uptime-core-PI/pull/1) tem descrição e já estava integrado; [CI 33657991688](https://github.com/danieLx77/uptime-core-PI/actions/runs/33657991688) verde para o workflow anterior de documentação. A configuração atual foi conferida localmente e aguarda execução remota. As quatro migrations SQL passaram em PostgreSQL 17 standalone. Consulte a [validação do D1](01-importacao.md#validação-do-d1) |

**Status geral: parcialmente atendido.** D1 precisa preceder a publicação dos próximos desafios. A equipe deve confirmar a entrega na organização da turma. A nova CI precisa rodar no GitHub após publicação autorizada. **Complexidade: baixa.**

## D2 · Domínio e arquitetura

**Objetivo e requisitos.** Monólito modular, pelo menos três contextos delimitados e um fluxo funcional ponta a ponta. Event Storming e C4 orientam o desenho e a comunicação das fronteiras.

- **Já existe e pode ser reaproveitado:** CRUD de monitores, scheduler, classificação de checagens, transição de incidentes, geração de alertas e o conjunto de testes HTTP/Prisma.
- **Adaptação:** agrupar Monitoramento (ciclo de monitor, agendamento e execução), Incidentes (estado da indisponibilidade e recuperação), Notificações (política, destinatário, conteúdo e histórico de alerta). Identidade é um contexto de suporte candidato, com credenciais e perfil. Os três primeiros têm estados e regras diferentes mesmo com o alerta simulado.
- **Melhorias e lacunas:** encapsular Prisma por contexto, impedir escritas nas tabelas dos vizinhos, definir contratos internos para resultado de checagem e mudança de incidente, e distinguir o console simulado de uma entrega de mensagem. Desenhar C4 e revisar invariantes em Event Storming.
- **Fluxo proposto:** cadastrar monitor → scheduler consulta alvo controlado → falha → incidente aberto → alerta persistido → alvo volta → incidente resolvido → alerta de recuperação. Demonstrar pelo HTTP e banco, sem chamar serviços externos reais.
- **Evidência e validação:** [server.js](../../src/server.js#L6), [SchedulerService](../../src/services/SchedulerService.js#L16), [IncidentService](../../src/services/IncidentService.js#L5), [AlertService](../../src/services/AlertService.js#L7). `tests/integration/incident.test.js` cobre parte do fluxo com resultado de checagem sintético. Scheduler e fluxo completo seguem pendentes de execução.

**Status geral: parcialmente atendido.** Depende da fundação e da validação da base. **Riscos:** migração de imports sem fronteira real e perda de comportamento administrativo. **Complexidade: média.**

## D3 · Microsserviços

**Objetivo e requisitos.** Contratos OpenAPI de dois serviços, Docker Compose, pelo menos dois serviços implantáveis independentemente, database per service e gateway ou BFF.

- **Reutilização direta:** Node, Dockerfile como template, lockfile, migrations como referência, health check, fluxo de geração Swagger e definição do Compose.
- **Adaptação:** o processo principal ainda é único em `src/server.js`. `scripts/generateSwagger.js` e `src/docs/swaggerSource.js` geram um contrato agregado para a API. A composição tem API e bancos de aplicação/teste. O parser aceitou o Compose, com execução de contêineres pendente.
- **Lacunas:** entrypoints, imagens, configurações, contratos e bancos independentes para os serviços, além de gateway. Extrair primeiro **Incidentes** e depois **Notificações**, mantendo Identidade e Monitoramento no núcleo. Separar tabelas e migrations, substituindo FKs e joins por IDs estáveis, contratos e composição por API quando necessária. No D4, migrar publicação de transições para eventos.
- **Impactos:** definir retenção após exclusão do monitor, retirar joins transversais dos controllers administrativos e preservar o contrato externo pelo gateway. Cada serviço terá credencial própria e será capaz de subir sem conhecer o banco de outro.

**Status geral: parcialmente atendido.** Depende de D2 e condiciona D4–D7. **Riscos:** quebrar a API existente ou reproduzir o acoplamento via chamadas HTTP em cadeia. **Complexidade: alta.**

## D4 · Mensageria, Outbox e idempotência

**Objetivo e requisitos.** Um evento publicado por Outbox transacional, consumidor idempotente e broker no ar. RabbitMQ, Kafka ou Redis Streams são aceitos.

- **Reutilização direta:** estado `OPEN`/`RESOLVED` e regra de transição do [IncidentService](../../src/services/IncidentService.js#L15), mais composição da mensagem e registro de alerta como base do consumidor.
- **Adaptação e melhorias:** o serviço chama o alerta em memória e aguarda o retorno. As duas escritas ocorrem separadamente e os erros são logados. A busca de incidente aberto ajuda no caminho sequencial. Uma transação e uma restrição de integridade precisam proteger a transição local concorrente.
- **Lacunas e proposta:** persistir `IncidentOpened` com a abertura na mesma transação PostgreSQL. Relay publica em RabbitMQ com confirmação e marca envio após o ack do broker. Usar `eventId` estável, chave única de inbox e transação local no consumidor para registrar inbox e alerta antes do ack. Definir backoff e fila de falhas para mensagens não processáveis. Testar rollback sem publicação, republicação após falha do relay e reentrega sem alerta duplicado.
- **Validação:** inspeção dos serviços, schema, dependências e Compose. Nenhum fluxo de entrega distribuída foi encontrado para teste.

**Status geral: não atendido.** Depende de D2/D3; fornece transporte para D5 e D6. **Riscos:** janela entre publicação e marcação do outbox e ordenação de abertura/resolução. **Complexidade: alta.**

## D5 · SAGA e compensação

**Objetivo e requisitos.** SAGA com alterações de estado distribuídas, compensação, teste de falha e ADR sobre coreografia ou orquestração.

O fluxo original registra uma queda real e tenta alertar. O incidente deve ser mantido se o alerta falhar. A inspeção de `IncidentService.handleStatus` e `AlertService.sendMockEmail` encontrou gravações independentes e logging de erro. Dá para reaproveitar as regras de incidentes e testes de transição, mas o domínio atual exige uma pequena extensão para demonstrar uma compensação com significado de negócio.

| Candidato | Início, etapas e êxito | Falha e compensação | Estado final e adequação |
|---|---|---|---|
| **Ativar monitor com política de notificação** | Usuário solicita ativação. Monitoramento registra `PENDING` e reserva a agenda desativada. Notificações provisiona política inativa, Incidentes registra política de abertura/escalonamento se exigida pelo produto. Após confirmações, o fluxo habilita política e agenda antes de marcar o monitor ativo | Falha definitiva ao provisionar/habilitar após reserva: desfazer a agenda e as políticas já criadas ou habilitadas, por ID da operação. Agenda só fica apta a checar após confirmação da ativação. Usar prazo e reconciliação para resposta perdida | Monitor preservado, inativo e com motivo de falha; sem agendamento ou política ativa residual. Extensão pequena, candidata principal, complexidade alta |
| Alterar política de escalonamento de um monitor ativo | Operador edita a política. Incidentes mantém versão atual, registra versão pendente e Notificações prepara o roteamento da nova versão. A promoção conclui a mudança | Se preparo ou promoção falhar, descartar recursos da versão pendente e preservar ou restaurar a versão anterior. Passos idempotentes por operação e versão | Roteamento anterior ativo sem perda de alertas. Útil se a equipe precisar de escalonamento; exige versionamento e mais estados, complexidade muito alta |
| Queda → incidente → alerta atual | Scheduler detecta queda, registra execução, Incidentes abre ocorrência e Notificações registra alerta | Se alertar falhar, manter o incidente e reprocessar a notificação. Já houve mudança de estado, que representa uma queda observada e permanece válida | Incidente aberto com entrega pendente ou falha. Adequado ao D2/D4 e inadequado como primeira SAGA compensável sem ampliar o fluxo; complexidade média para entrega durável |

**Proposta e verificação futura.** ADR para escolher a estratégia. A orquestração facilita acompanhar estado, prazo e compensações da ativação; a coreografia reduz o ponto coordenador, com custo de rastrear o fluxo e as condições de rollback. Testar falha depois de pelo menos uma reserva confirmada, verificar o estado persistido final e testar duplicidade e confirmação perdida. Nenhuma SAGA ou teste de compensação foi executado nesta etapa.

**Status geral: não atendido.** Depende de D2–D4 e de aprovação da transação pela equipe e pelo professor. **Risco principal:** usar a abertura do incidente como efeito descartável ou planejar somente retry. **Complexidade: alta.**

## D6 · CQRS e Event Sourcing

**Objetivo e entregável.** Pelo menos um read model alimentado por eventos. Projeções, replay e Event Sourcing são conteúdos associados.

As consultas administrativas em `AdminIncidentController.index`, `AdminAlertController.index` e `AdminCheckExecutionController.index` aplicam filtros e joins diretamente no schema de escrita. A separação por endpoint e a tabela de checagens fornecem regras e histórico úteis. Nenhuma projeção/event store foi identificada em schema, migrations ou serviços, e nenhuma execução de replay foi validada.

**Proposta.** Projeção `MonitorOverview` para último status/latência, disponibilidade em janela, incidente aberto e estado de notificação. Consumir resultados de checagem e eventos de incidentes/alertas, deduplicar por ID e usar versão ou timestamp para atualizações atrasadas. Validar consulta, reentrega e reconstrução a partir de eventos retidos ou exportação controlada. Um read model alimentado por eventos atende ao resumo do D6. Event Sourcing integral como fonte de verdade precisa de confirmação no enunciado detalhado.

**Status geral: não atendido.** Depende de D3/D4; pode incluir eventos da SAGA após D5. **Riscos:** histórico insuficiente para replay e projeção desatualizada após reordenação. **Complexidade: alta.**

## D7 · Resiliência e observabilidade

**Objetivo e requisitos.** Circuit breaker, rastreio ponta a ponta, timeout, retry e Correlation ID em todos os logs.

- **Já existe e pode ser mantido:** timeout de dez segundos no Axios, isolamento de exceções por monitor e health simples da API. `AlertService`, `IncidentService` e scheduler usam `console`. Sem política de retry/backoff, circuit breaker, correlação, métricas instrumentadas ou tracing.
- **Adaptação:** manter a semântica de falha do alvo monitorado e distingui-la da falha de serviço interno. Usar timeouts e circuit breaker no gateway ao acessar Notificações, com fallback para último estado conhecido e indicação de desatualização. Usar retry limitado para leitura e comandos idempotentes, com jitter. Em passos mutáveis da SAGA, combinar chave de operação e reconciliação.
- **Evidência e validação futura:** `PingService.execute` configura timeout. Instrumentar request, job cron, evento e consumidor com Correlation ID, propagação de contexto e spans HTTP/mensageria. Validar circuito aberto/meio aberto, prazo de resposta e trilha de uma operação distribuída. Health deve separar liveness de readiness.

**Status geral: parcialmente atendido.** Depende de D3/D4 e deve observar D5/D6. Durante falha de Notificações, cadastro, checagens, incidentes e consultas úteis devem continuar. **Riscos:** retry gerar efeito duplicado e circuit breaker mascarar indisponibilidade do endpoint monitorado. **Complexidade: alta.**

## D8 · Entrega e operação

**Objetivo e requisitos.** Deploy gratuito, README reprodutível, roteiro do caos, gestão segura de segredos e pipeline funcional. Contratos e feature flags fazem parte do conteúdo do encontro.

- **Reutilização e adaptação:** Dockerfile, Compose, migrações, lockfile, comandos de configuração e referência histórica do pipeline de origem. O README acadêmico descreve a execução da API importada. A CI do D1 configura validações da API. A execução remota do novo workflow e a entrega do D8 estão pendentes.
- **Lacunas:** deploy acadêmico, CI/CD e SonarCloud próprios, documentação verificada do sistema distribuído e roteiro ensaiado. Isolar ambientes e secrets, excluir arquivos sensíveis do contexto Docker, remover referências de produção original do Swagger e exigir configuração própria por ambiente.
- **Validação:** Compose aceitou a configuração. A execução local e o build da imagem ficaram bloqueados. O deploy existente documentado refere-se à origem. Há um [cenário preliminar](05-plano-de-adaptacao.md#teste-do-caos-proposto) para revisão.
- **Proposta:** CI com lint, validação dos contratos e integração isolada. Deploy autorizado de revisões aprovadas, em provedor gratuito que suporte o desenho final; validar limites de banco, broker, processos e suspensão de instâncias antes da escolha.

**Status geral: parcialmente atendido.** Depende de D1 e D3–D7. **Riscos:** limite de recursos gratuitos, vazamento de artefatos locais na imagem e falha de demonstração por retomada lenta de serviços. **Complexidade: alta.**
