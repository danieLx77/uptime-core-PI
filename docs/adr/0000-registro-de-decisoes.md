# 0000. Registro de Decisões de Arquitetura

* **Status:** Aceito
* **Data:** 2026-09-02

## Contexto
Durante o desenvolvimento do sistema distribuído, precisaremos tomar diversas decisões arquiteturais (divisão de contextos, mensageria, padrões de resiliência). Sem um registro formal, a motivação por trás dessas escolhas se perde.

## Decisão
Adotaremos o formato *Architecture Decision Records (ADR)* para documentar decisões estruturais. Os arquivos ficarão na pasta `docs/adr/` e seguirão uma numeração sequencial.

## Consequências
* **Positivas:** Histórico técnico preservado, facilitando a defesa do projeto na Vitrine e o onboarding de novos conceitos.
* **Negativas:** Leve aumento no tempo de documentação antes de aprovar Pull Requests complexos.