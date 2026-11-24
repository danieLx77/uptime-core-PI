# Operação do D3

O [README](../README.md) descreve o Compose local. O [guia de desenvolvimento](development.md) cobre migração e configuração.

| Componente | Rede | Porta | Saúde |
|---|---|---|---|
| Gateway | edge | 3000 publicada | `GET /gateway/health` |
| Núcleo | edge, core-data | 3001 interna | `GET /api/health` |
| Incidentes | edge, incidents-data | 3002 interna | `GET /api/health` |
| PostgreSQL Núcleo | core-data | 5432 interna | `pg_isready` |
| PostgreSQL Incidentes | incidents-data | 5432 interna | `pg_isready` |

Cada serviço aguarda a saúde de seu banco antes de aplicar migrations. Os health checks HTTP verificam a capacidade de responder. O smoke do Compose exercita cadastro, login e persistência pelo Gateway. O fluxo de checagem com dois bancos usa alvos locais em testes. Reinicie uma unidade com `docker compose restart core` ou `docker compose restart incidents` e espere a saúde voltar via `docker compose up -d --wait`.

O Gateway devolve `502` se o serviço estiver indisponível e `504` ao atingir oito segundos. Os clientes internos têm três segundos por requisição e não fazem retentativa. Falhas de saída HTTP para Incidentes ficam visíveis no log do Núcleo. Após erro de composição das projeções do Núcleo, Incidentes responde `503`. Health segue disponível se o serviço estiver rodando.

O Compose usa credenciais de desenvolvimento separadas, volumes e redes de persistência privadas. Gere chaves fora do Git. Antes de expor o ambiente, defina limites de saída e TLS conforme a plataforma. A CI não depende de SonarCloud, Render ou SMTP externo.

## Ciclos de monitoramento

O Compose sobe uma instância do Núcleo. `node-cron` 4.2.1 impede sobreposição no processo e emite eventos de execução perdida e de sobreposição. Procure nos logs do Núcleo pelo início e pelo encerramento de cada ciclo, pelo tempo total em milissegundos e pelos avisos de tick descartado por sobreposição ou tick perdido. O aviso de tick perdido não informa o horário exato, pois a biblioteca pode reportar o próximo horário calculado em vez do horário perdido. Os erros de consulta e de checagem continuam registrados.

Um ciclo longo pode fazer uma verificação perder o horário previsto. Os ticks não são recuperados nesta versão. A entrega assíncrona planejada para o D4 reduz o tempo gasto em HTTP com Incidentes, mas sondagens lentas ainda podem alongar um ciclo.
