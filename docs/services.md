# Serviços e comunicação

O Núcleo registra `CheckExecution` antes de enviar `POST /internal/check-results` a Incidentes. O payload contém ID e instante da execução, monitor, resultado HTTP, erro e projeção mínima para formatar o alerta. A chamada usa o cabeçalho `X-Service-Token` com credencial de serviço. Incidentes retorna a transição e o ID do incidente.

Incidentes usa `POST /internal/monitors/query` com IDs em lotes de até 500 para completar o histórico administrativo. O Gateway não publica rotas `/internal`. A listagem conserva os filtros e retorna `monitor: null` quando o cadastro foi removido. Um erro ao consultar o Núcleo gera `503`.

As requisições entre serviços acontecem após transações locais. Um erro de transmissão não apaga a execução já gravada e não causa retentativa. Um erro ao registrar alerta não desfaz o incidente. Execuções duplicadas ou fora de ordem após recuperação podem produzir uma nova ocorrência, mesmo com unicidade de incidente aberto. O D4 deverá tratar entrega e deduplicação por ID de execução.

Contratos [Núcleo](../services/core/openapi/openapi.json) e [Incidentes](../services/incidents/openapi/openapi.json).
