# Visão do produto · Uptime Core PI

## Problema e público-alvo

A indisponibilidade de APIs e serviços web sem aviso pode afetar receita e operação. Muitas equipes descobrem uma falha pelo relato de clientes. O Uptime Core PI atende engenheiros de software, equipes de DevOps e administradores de sistemas que precisam verificar disponibilidade e investigar ocorrências.

## Escopo atual

Usuários autenticados cadastram URLs HTTP ou HTTPS acessíveis publicamente e configuram seus intervalos. A aplicação checa alvos ativos, guarda tempo de resposta e registra indisponibilidades e recuperações. Administradores consultam monitores, execuções, incidentes e alertas. A recuperação de senha usa SMTP. Os alertas operacionais são registrados e simulados no console.

## Fluxo que atravessa contextos

1. **Identidade e acesso** autentica o usuário que cadastra o monitor.
2. **Monitoramento** agenda, realiza e registra as verificações HTTP.
3. **Incidentes** abre uma ocorrência na primeira falha e a resolve quando o alvo volta a responder.
4. **Notificações** registra alertas nas transições automáticas. Cada monitor tem no máximo um incidente aberto. As falhas repetidas mantêm o incidente aberto até a recuperação.

O produto tem uma entrada pública única e dois serviços implantáveis, com [contextos delimitados](architecture.md). O Núcleo comunica os resultados ao serviço de Incidentes. Uma falha no registro do alerta preserva o incidente, que representa indisponibilidade observada.

## Transação candidata para o D5

A **ativação de monitor com agenda registrada e política de notificação** é uma hipótese para avaliar com a equipe. Se o produto precisar provisionar ambos os recursos, uma falha depois da reserva da agenda pode exigir cancelar a agenda e desfazer a política parcialmente criada, preservando o monitor inativo. Outra possibilidade é alterar uma política já ativa, com configuração anterior preservada até a confirmação. Essa opção exige versionamento e demanda uma justificativa de produto própria.

O código atual usa seleção pelo relógio, um intervalo persistido e uma mensagem de alerta simulada. Antes de escolher a SAGA, confirmar a necessidade da política, seu proprietário, o estado de ativação e a compensação diante de respostas tardias. O [domínio](dominio.md) descreve as regras atuais.
