# Visão do Produto: UptimeCore API

## O Problema
A indisponibilidade de APIs e serviços web sem aviso prévio causa prejuízos financeiros e operacionais. Equipes frequentemente descobrem falhas pelos clientes devido à falta de monitoramento automatizado.

## Público-Alvo
Engenheiros de Software, equipes de DevOps e Administradores de Sistemas que precisam garantir a disponibilidade de suas aplicações.

## A Transação que Atravessa Contextos
A transação distribuída principal (que será tratada via SAGA) ocorre quando um serviço cai:
1. O **Contexto de Checagem** detecta a falha de conectividade (timeout ou erro HTTP).
2. O **Contexto de Incidentes** abre um registro oficial de queda.
3. O **Contexto de Notificação** dispara um alerta (e-mail/webhook) para a equipe.
*Ponto de falha:* Se o serviço de notificação cair, o incidente não pode ser perdido, exigindo retentativas ou compensação.