# 01 · Importação e validação

## Registro inicial

| Item | Origem | Destino |
|---|---|---|
| Caminho absoluto | `/home/daniel/Área de trabalho/Projeto-Integrador/Uptime-original/uptime-core-api` | `/home/daniel/Área de trabalho/Projeto-Integrador/Final/uptime-core-PI` |
| Branch | `main`, rastreando `origin/main` | `desafio-01`, rastreando `origin/desafio-01` |
| HEAD | `9d7c314bb485a173d6dd2beda78fb66cd8440b5b` | `806b9a1443938b8f1de5bbf3bf1f59327f2624e7` |
| Working tree | Limpa, sem arquivos não rastreados reportados pelo Git | Limpa |
| Remote de fetch e push | `https://github.com/joaogsribeiro/uptime-core-api.git` | `https://github.com/danieLx77/uptime-core-PI.git` |

Os diretórios têm raízes e diretórios Git distintos. A inspeção inicial usou Git com `--no-optional-locks` para evitar atualização opcional do índice. Foram lidos os READMEs, a documentação de desenvolvimento e operação, as licenças e o workflow acadêmico. A busca local pelos `AGENTS.md` de projeto não encontrou arquivos adicionais.

## Seleção e conflitos

| Conteúdo da origem | Tratamento |
|---|---|
| `src/`, `scripts/`, `tests/`, `prisma/` | Importados, incluindo quatro migrations SQL e o lock de migrations |
| `package.json`, `package-lock.json`, `prisma.config.ts`, `jest.config.js`, `eslint.config.js`, `.prettierrc`, `.husky/pre-commit` | Importados. A instalação de avaliação usou `HUSKY=0` para preservar a configuração Git |
| `Dockerfile`, `docker-compose.yml`, `.env.example` | Importados. Os valores do exemplo e do Compose são demonstrativos. Use credenciais geradas para qualquer ambiente compartilhado |
| `docs/api.md`, `docs/architecture.md`, `docs/development.md`, `docs/operations.md`, `docs/services.md` e coleção Insomnia | Importados como referência técnica original |
| `LICENSE` | MIT original com copyright de João Guilherme Ribeiro preservada em `LICENSE.uptime-core-api`. O `LICENSE` acadêmico permanece no caminho original |
| `README.md` e `.gitignore` | Conteúdo acadêmico mantido e complementado com instruções locais e exclusões de arquivos gerados |
| `.github/workflows/pipeline.yml` e `sonar-project.properties` | Excluídos da cópia. A pipeline dispara deploy por hook e a configuração Sonar identifica projeto e organização de origem. O workflow acadêmico foi preservado |
| `.git`, arquivos locais, segredos reais, dependências, caches, dados, dumps e saídas de build | Fora do conjunto elegível. A cópia foi feita somente a partir do snapshot do HEAD |

Os 60 arquivos copiados correspondem byte a byte ao snapshot, contabilizando o aviso MIT renomeado. Os arquivos acadêmicos `docs/equipe.md`, `docs/visao-produto.md` e `docs/adr/0000-registro-de-decisoes.md` foram preservados. A revisão por nomes, padrões de segredos e inspeção dos exemplos, workflow e coleção Insomnia encontrou valores demonstrativos, placeholders e referências a secrets do GitHub. A coleção usa `base_url` local e token vazio.

## Referências externas a adaptar

- O gerador Swagger oferece o servidor Render original além do local. A documentação original em `docs/api.md`, `docs/operations.md` e `docs/services.md` usa esse endereço e `docs/development.md` cita o clone original. Para testes do PI, use apenas o ambiente local. Na etapa de entrega, troque o servidor Swagger e revise os guias e exemplos.
- A configuração original do Sonar aponta para `joaogsribeiro_uptime-core-api` e organização `joaogsribeiro`. Configure projeto acadêmico e `SONAR_TOKEN` próprios em etapa autorizada. O workflow original usa o secret `RENDER_DEPLOY_HOOK` em uma etapa também alcançável por PR. Use gatilho de deploy específico do destino quando a equipe decidir publicar.
- O Compose tem nomes de contêiner e portas fixos. Podem colidir com outro ambiente local. O exemplo SMTP usa referência didática ao Mailtrap. Use capturador local ou credenciais acadêmicas próprias.
- O nome npm `uptime-core-api` é metadado do pacote; o lockfile não depende de checkout, caminhos absolutos ou pacotes locais da origem. O gerador Swagger resolve caminhos dentro do próprio repositório.

## Validações

| Comando ou verificação | Resultado observado e continuidade |
|---|---|
| `HUSKY=0 npm ci --offline --no-audit --no-fund` | Falhou com `ENOTCACHED` no tarball de `zeptomatch@2.1.0`. O cache local não contém todo o lockfile |
| `HUSKY=0 npm ci --no-audit --no-fund --fetch-retries=0 --fetch-timeout=15000` | Encerrou com `Exit handler never called!`. O npm também informou que não podia escrever em seu diretório de logs |
| `curl -sSI --connect-timeout 5 --max-time 8 https://registry.npmjs.org/zeptomatch/-/zeptomatch-2.1.0.tgz` | `Could not resolve host: registry.npmjs.org`. Repetir com DNS e acesso ao registry e cache npm gravável |
| `find src tests scripts -name '*.js' -print0 \| xargs -0 -n1 node --check` e `node --check` nas configurações ESLint, Jest e Prisma | Aprovados no Node 24.10.0. Verificam sintaxe |
| `npm run swagger` | `ERR_MODULE_NOT_FOUND` ao resolver `swagger-autogen` da instalação incompleta |
| `node node_modules/prisma/build/index.js generate`, invocação direta do ESLint e `prettier --check` pela instalação local | `MODULE_NOT_FOUND` para os executáveis. Lint, formatação, Prisma Client e cobertura pendentes |
| `docker compose -p uptime_pi_assessment config --quiet` | Aprovado com aviso de que o atributo `version` é obsoleto |
| `docker info --format '{{.ServerVersion}}'` | Acesso ao socket do daemon negado. Build da imagem e subida do Compose pendentes |
| Tentativa de bind de teste em TCP loopback e Unix socket | Ambos negados com `Operation not permitted`. PostgreSQL 17 estava instalado no host, mas não pôde ser usado para iniciar um banco isolado nesse ambiente |
| Migrations, testes de integração, execução e smoke tests | Pendentes de dependências completas e ambiente com socket local ou Docker. A suíte usa dados descartáveis e simula SMTP. Ela não deve apontar para o banco da origem |
| GitHub Actions no commit acadêmico inicial | [Execução 33657991688](https://github.com/danieLx77/uptime-core-PI/actions/runs/33657991688) verde. O workflow faz checkout e `echo`, sem build, lint ou testes da API |

Pré-requisitos da continuação: Node 24/npm, PostgreSQL local isolado (Compose define PostgreSQL 15), portas disponíveis e Docker para build em imagem. Defina `DATABASE_URL` e `JWT_SECRET` por ambiente. `PORT`, `NODE_ENV`, `JWT_EXPIRES_IN` e `ALLOWED_ORIGINS` configuram servidor e autenticação. `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER` e `MAIL_PASS` habilitam o fluxo de recuperação real. Com dependências instaladas, gere Prisma e Swagger, aplique `npm run db:migrate`, execute `npm run lint` e prepare `.env.test` para `npm run test:db-setup` e `npm test -- --coverage`. Para a execução local use `npm start`; verifique apresentação, health, Swagger e o fluxo registro → login → monitor com alvo sintético.

Os bloqueios de registry, dependências e sockets são do ambiente de validação. As limitações do Compose, da CI simulada e as referências aos provedores externos já estavam nas respectivas bases. Não houve falha funcional confirmada decorrente da importação.

## Validação do D1

| Verificação | Resultado |
|---|---|
| `npm ci --offline --dry-run --ignore-scripts` | A simulação de resolução passou com Node 24.10.0 e npm 11.6.1 |
| `HUSKY=0 npm ci --offline --no-audit --no-fund` | Bloqueado por `ENOTCACHED` no tarball de `zeptomatch@2.1.0` |
| `HUSKY=0 npm ci --prefer-offline --no-audit --no-fund --fetch-retries=0 --fetch-timeout=8000` e `curl -sSI https://registry.npmjs.org/` | A nova tentativa retornou `Exit handler never called!`. O curl confirmou que o ambiente não resolve o domínio do registry |
| `node --check` nos arquivos da aplicação, scripts, testes e configurações | Sintaxe aprovada |
| `prettier --check 'src/**/*.js'` com Prettier 3.9.10 do cache | Formatação aprovada na versão local disponível. O lockfile usa 3.8.3 |
| `npm run lint`, `npm run swagger` e `npm test -- --listTests` | A instalação incompleta deixou ESLint, swagger-autogen e cross-env indisponíveis. A geração do Prisma Client também depende da instalação |
| `initdb` e `postgres --single -j` no PostgreSQL 17.7 | Os quatro arquivos SQL foram aplicados em ordem em um banco novo, sem conexões externas. As cinco tabelas e as colunas adicionadas pelas migrations foram conferidas. A execução de `prisma migrate deploy` e a validação em PostgreSQL 15 seguem pendentes |
| `docker compose -p uptime_pi_d1 config --quiet` | Configuração aceita com aviso sobre o campo `version` |
| `docker compose -p uptime_pi_d1 build api` | O ambiente negou acesso ao socket do Docker. O bind TCP e Unix também foi negado. Build e smoke tests pendentes |
| `.github/workflows/ci.yml` | YAML, gatilhos, configuração do serviço e comandos conferidos localmente. O novo workflow ainda precisa ser executado no GitHub |

**Integração:** nenhum dos 58 casos identificados na suíte foi executado. Resultado de cobertura indisponível. A execução precisa de instalação completa e PostgreSQL descartável acessível ao Node.

**Entrega:** o repositório remoto configurado é público e pertence à conta pessoal `danieLx77`. A entrega na organização `gcc267-2026-2` segue pendente de confirmação.

## Integridade

A verificação final comparou HEAD, branch, status e remotes da origem com o registro inicial. Também comparou a lista de caminhos, tipos e modos e os hashes dos arquivos regulares, incluindo `.git`. O destino manteve HEAD, configuração, índice e histórico Git. As mudanças ficaram locais no destino. Nenhum commit, push, merge, deploy ou PR foi realizado durante o trabalho.
