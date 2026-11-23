# Diagnóstico do Uptime Core PI

A base do Uptime Core API foi importada para o repositório acadêmico a partir do commit `9d7c314bb485a173d6dd2beda78fb66cd8440b5b`. A implementação é uma API Express com um scheduler no mesmo processo e um banco PostgreSQL compartilhado. A importação mantém código, migrations, testes e contêineres da base, além da licença de origem.

O projeto é adequado à evolução incremental da disciplina, condicionada à aprovação de uma transação compensável para o D5. O fluxo atual de queda, incidente e alerta serve como demonstração funcional candidata para o D2. Para o D5, a recomendação é ativar um monitor com provisionamento de agenda e política de notificação. A compensação desfaz o provisionamento e mantém o cadastro inativo para nova tentativa.

A sintaxe passou com Node 24, o Compose foi aceito pelo parser e as quatro migrations SQL passaram em PostgreSQL 17 isolado. A CI da API foi configurada no D1. A instalação bloqueada neste ambiente impediu a suíte de integração, e o novo workflow aguarda execução no GitHub.

| Documento | Conteúdo |
|---|---|
| [01 · Importação](01-importacao.md) | Origem, arquivos, dependências, limites, validações e integridade |
| [02 · Diagnóstico técnico](02-diagnostico-tecnico.md) | Implementação, fluxos, persistência, infraestrutura e riscos |
| [03 · Análise dos desafios](03-analise-dos-desafios.md) | Evidências, lacunas, reaproveitamento e proposta para D1 a D8 |
| [04 · Matriz de conformidade](04-matriz-de-conformidade.md) | Requisitos por desafio, rubrica final e ferramentas obrigatórias |
| [05 · Plano de adaptação](05-plano-de-adaptacao.md) | Arquitetura candidata, dependências, sprints e teste do caos |

Fonte acadêmica: Rafael S. Durelli, *GCC267 — Projeto Integrador I, Encontro 1 — Como esta disciplina funciona*, UFLA, turma 14A, 2026/2. Slides 13, 16–17, 19–20, 22, 26 e 28–29, nas páginas 16, 19–20, 23–24, 27, 32 e 35–36 do PDF. O D1 tem enunciado integral no material. O D2 ao D8 usam os resumos, a rubrica final e os marcos das sprints.
