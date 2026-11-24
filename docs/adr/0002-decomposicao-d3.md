# 0002. Decomposição dos serviços do D3

* **Status:** Aceito
* **Data:** 2026-11-23

## Contexto

O [D2](0001-monolito-modular.md) separou quatro contextos em um processo e um PostgreSQL. O D3 exige dois contratos e dois serviços construíveis e executáveis separadamente, com persistência de propriedade exclusiva e entrada pública comum.

## Alternativas

| Recorte | Consequência |
|---|---|
| Extrair Identidade | Preserva o pipeline de checagens junto aos incidentes e obriga vários casos de uso a consultar identidade remotamente |
| Extrair Monitoramento | Cria uma fronteira no produtor, mas deixa administração de contas e incidentes no mesmo serviço sem coesão operacional |
| Extrair Incidentes e Notificações juntos | Mantém captura e execução no Núcleo e concentra ocorrência e alerta em outro banco, com uma travessia de rede no fluxo principal |
| Um serviço por contexto | Aumenta número de deploys e dependências síncronas entre incidentes e alertas para a escala desta entrega |

## Decisão

O **Núcleo** possui Identidade e Monitoramento. **Incidentes** possui Incidentes e Notificações. Cada um tem Dockerfile, processo, configuração, cliente Prisma, migrations, credenciais e PostgreSQL próprios. O **Gateway** encaminha rotas públicas sem persistência nem regras de domínio.

O Núcleo salva a execução, então envia o resultado por HTTP autenticado. Consultas administrativas de Incidentes buscam projeções de monitores no Núcleo em lotes. O token de serviço é separado do JWT. Os serviços validam JWT localmente com a chave compartilhada e verificam roles onde executam a operação. Assinatura assimétrica é alternativa para uma implantação com fronteiras de confiança mais amplas.

## Consequências e limites

Start e health de cada serviço independem do outro. As operações remotas usam prazo e falham de modo explícito. O histórico de incidentes permanece quando o monitor é excluído. A consulta correspondente devolve `monitor: null`. As referências externas deixam de ter foreign keys e a transferência do D2 usa snapshot e dois destinos preparados. Os comandos do [guia de migração](../development.md#transferir-dados-do-d2) explicitam o corte e a recuperação em caso de falha.

Uma execução pode ser salva antes de o envio falhar. Um incidente pode ser salvo antes de falhar o alerta. O D4 poderá publicar a conclusão de uma execução via Outbox. A ativação de monitor com política de notificação segue candidata a SAGA. As consultas combinadas são candidatas a projeções de leitura. Os pontos de timeout e os ambientes independentes sustentam os desafios posteriores de resiliência e implantação.
