# 0001. Monólito modular com composição explícita

* **Status:** Aceito
* **Data:** 2026-11-23

## Contexto

A API do D1 organiza rotas, controllers e serviços em diretórios técnicos comuns. O serviço de incidentes grava execuções e aciona alertas diretamente. Essa estrutura distribui as regras de um mesmo domínio entre várias pastas e deixa o cliente Prisma disponível para responsabilidades distintas. O D2 exige fronteiras demonstráveis no mesmo sistema implantável.

## Alternativas consideradas

| Alternativa | Consequência |
|---|---|
| Manter o desenho por camadas técnicas | Preserva a organização familiar, mas depende de convenções implícitas para impedir acoplamento entre domínios |
| Organizar por contexto e compor chamadas em memória | Define propriedade de dados e operações públicas, preservando as rotas HTTP, a ordem de efeitos e um único ambiente de execução |
| Extrair serviços agora | Dá independência de deploy, com custo imediato de contratos de rede, migração de dados e consistência distribuída |

## Decisão

Adotar quatro contextos internos. Monitoramento possui monitor e execução. Incidentes possui o ciclo de indisponibilidade. Notificações possui registro de alertas. Identidade e acesso possui usuários, autenticação e recuperação de credenciais.

Os contextos expõem operações selecionadas por `index.js` e usam persistência com acesso aos próprios modelos. A composição HTTP integra os módulos. Um fluxo específico recebe o resultado do scheduler, grava execução, atualiza incidente e solicita alerta. A comunicação síncrona é suficiente para manter a ordem e o tratamento de falhas existentes. Um barramento em memória aumentaria a infraestrutura e tornaria a ordem menos explícita.

Preservar o banco, as migrations e as projeções relacionais de leitura dos endpoints. O PostgreSQL continua impondo integridade referencial. Um analisador ESM no job da CI verifica a direção dos imports e impede que consumidores internos alcancem a implementação privada de outro contexto.

## Consequências

- As fronteiras e os pontos de composição ficam verificáveis. O código continua executável como um único serviço com o stack do D1.
- A composição passa a ser responsável por ligar os contratos. Joins Prisma e efeitos em cascata ainda exigem análise antes de separar os dados.
- Falhas de persistência conservam os efeitos parciais já possíveis na base. A abertura de incidente segue sujeita a corrida entre execuções concorrentes.
- O guard verifica imports e reexports estáticos. As operações acessadas por delegates e imports dinâmicos exigem revisão de código.
- O D3 pode aproveitar a separação. As escolhas de recorte, banco por serviço, integração distribuída e eventual SAGA dependem de decisões posteriores.

A [arquitetura](../architecture.md) detalha os contratos, os pontos de verificação e as exceções de leitura.
