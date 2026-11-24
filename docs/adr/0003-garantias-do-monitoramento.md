# 0003. Segurança da checagem e consistência das transições

* **Status:** Aceito
* **Data:** 2026-11-23

## Contexto

URLs do usuário são acessadas pelo servidor. O banco antigo admitia incidentes simultâneos e mantinha tokens de recuperação em claro até o consumo.

## Alternativas e decisão

- **Destinos HTTP.** A validação só no cadastro deixa o DNS mudar depois. Delegar ao proxy de ambiente deixa a decisão de rede fora do serviço. O Núcleo valida protocolo e destino literal, valida todas as respostas da resolução usada pela conexão e só entrega endereços aprovados ao socket. HTTPS preserva validação de certificado e hostname. A checagem usa agentes diretos e desabilita redirecionamentos. O intervalo de resposta é limitado a dez segundos e o corpo descomprimido a 1 MiB. Um bloqueio de política é logado e não gera incidente. Para monitorar um endereço que responde com redirecionamento, cadastre o endereço público final.
- **Transições.** Mutex no processo protege apenas uma instância. O PostgreSQL de Incidentes usa índice único parcial, inserção com conflito direcionado e atualização condicionada ao estado aberto. Apenas a transição vencedora pede alerta. Em uma instância, o cron também ignora um tick quando o anterior ainda está em execução.
- **Recuperação.** O segredo aleatório original segue pelo SMTP. O Núcleo armazena SHA-256 e consome o digest com um único UPDATE, que verifica validade no relógio do banco e altera senha e digest na mesma operação. A transferência invalida tokens antigos sem mudar senhas existentes.

## Consequências e riscos

O índice mantém históricos encerrados e interrompe a migration se houver aberturas duplicadas preexistentes. Nenhum saneamento automático altera o histórico. Verificações fora de ordem ainda são tratadas pela ordem em que chegam. A unicidade de uma transição não garante entrega do alerta. A rede do deploy deve reforçar a filtragem de saída e controlar destinos especiais da infraestrutura.

Os testes habilitam somente uma origem de loopback exata sob `NODE_ENV=test`. Essa configuração pertence à suíte e não é disponibilizada pela API ou pelo Compose normal. Recuperação mantém resposta genérica ao solicitar um token, inclusive em erro de SMTP. A revisão de rate limiting, proteção de temporização e chaves assimétricas pode ocorrer junto à preparação de um deploy.
