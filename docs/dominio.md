# Domínio de monitoramento

O Uptime Core PI ajuda desenvolvedores, DevOps e administradores a acompanhar disponibilidade de serviços HTTP. Um usuário configura o alvo. O scheduler aplica o intervalo, e o administrador consulta as execuções, incidentes e alertas. O servidor monitorado responde à verificação com um status HTTP ou falha de transporte. SMTP atende à recuperação de conta.

## Glossário

| Termo | Significado no produto |
|---|---|
| Monitor | Cadastro de uma URL com dono, nome, intervalo e estado ativo ou pausado |
| Checagem | Uma tentativa HTTP de consultar o alvo. Seu resultado inclui disponibilidade, código quando recebido, latência e motivo de falha |
| Execução de checagem | Registro persistido de uma checagem. Guarda código HTTP ou `null` e tempo de resposta |
| Intervalo | Frequência avaliada pelo módulo do minuto da hora. A cada tick, só monitores ativos elegíveis são selecionados |
| Disponibilidade | Sucesso da requisição segundo o comportamento padrão do Axios, com timeout de dez segundos configurado |
| Incidente | Registro operacional de indisponibilidade, com estados `OPEN` e `RESOLVED` |
| Alerta | Registro da notificação operacional simulada. Identifica o monitor, a transição associada e a mensagem |
| Usuário e administrador | Identidade autenticada por JWT. A role de administrador permite acessar o histórico operacional e executar as ações administrativas existentes |

Uma execução é um fato pontual. Um incidente representa um período de indisponibilidade. O destinatário de alerta é uma projeção do dono do monitor e conserva somente nome e e-mail para montar a mensagem.

## Regras verificadas no código

- Monitores ativos são selecionados por `minuto % intervalo === 0` e processados sequencialmente no ciclo. Falhas são isoladas por monitor.
- Cada resultado é gravado antes da avaliação do incidente. A primeira falha sem incidente aberto inicia uma ocorrência; a falha seguinte mantém a ocorrência aberta. A recuperação resolve a ocorrência aberta. Checagem bem-sucedida sem incidente aberto só registra a execução.
- A abertura e a recuperação automáticas geram alerta. A resolução e a reabertura administrativas preservam seu comportamento direto. A mensagem operacional é registrada e exibida no console.
- O dono pode gerenciar seus monitores. Administradores têm as permissões previstas nas rotas e nos controllers. O histórico operacional exige autenticação e role de administrador.
- Há no máximo um incidente aberto por monitor. O banco de Incidentes garante a invariante e só a transição vencedora produz um alerta novo. O cron pula um tick enquanto o anterior ainda está em execução na mesma instância. A regra de intervalo também conserva a virada de hora e os limites existentes.

## Event Storming preliminar

Modelagem técnica derivada da implementação e dos testes. Os eventos abaixo representam fatos do domínio para discussão. A implementação usa HTTP interno síncrono entre serviços e operações locais de banco.

| Ator ou política | Comando | Fato conceitual | Regra ou reação | Contexto |
|---|---|---|---|---|
| Usuário autenticado | Cadastrar monitor | Monitor cadastrado | Associa dono, URL e intervalo | Monitoramento |
| Tick do scheduler | Executar checagem elegível | Checagem executada | Requisição ao alvo HTTP e gravação do resultado | Monitoramento |
| Resultado de falha | Avaliar disponibilidade | Incidente aberto quando não há ocorrência aberta | Falha repetida conserva ocorrência existente | Incidentes |
| Resultado de sucesso | Avaliar disponibilidade | Incidente resolvido se havia ocorrência aberta | Grava data de resolução | Incidentes |
| Transição automática | Registrar alerta | Alerta registrado | Monta mensagem e simula entrega | Notificações |
| Administrador | Resolver ou reabrir ocorrência | Incidente alterado manualmente | Exige role administrativa e estado compatível | Incidentes |
| Usuário | Solicitar recuperação | Token de recuperação gerado | Persiste token temporário e aciona SMTP | Identidade e acesso |

Os cenários e o encadeamento técnico estão no [fluxo de monitoramento](services.md).

Núcleo possui usuários, monitores e execuções. Incidentes possui incidentes e alertas e referencia monitores por ID. Um destino recusado pela política não gera incidente de indisponibilidade. A ordem de chegada do resultado ainda é relevante e a entrega de uma execução salva pode falhar.
