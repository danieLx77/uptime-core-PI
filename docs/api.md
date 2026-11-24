# Contratos HTTP do D3

- [OpenAPI do Núcleo](../services/core/openapi/openapi.json)
- [OpenAPI de Incidentes](../services/incidents/openapi/openapi.json)
- Swagger UI no Gateway em `/api/docs/`, com seletor de serviços.

O contrato público segue no prefixo `/api`. Login devolve JWT para `Authorization: Bearer …`. Cada serviço valida permissões locais. O Gateway responde `502` ou `504` quando o destino falha ou atinge o prazo. Histórico de incidentes e alertas pode conter `monitor: null` após exclusão do cadastro e devolver `503` quando o Núcleo está indisponível. Uma reabertura administrativa que conflite com outro incidente aberto retorna `409`. Cadastro e edição de URL proibida retornam `400`.

Os caminhos internos documentados são destinados aos processos que usam `X-Service-Token`. A coleção [Insomnia](insomnia/UptimeCore_API_Insomnia_Collection.yaml) tem exemplos do D2 que ainda podem ser usados com o Gateway para as rotas públicas compatíveis. Consulte as especificações acima para as mudanças do D3.

O OpenAPI é validado estruturalmente na CI e o verificador de rotas confere os métodos e caminhos das 31 operações. A suíte HTTP valida schemas de respostas exercitadas de login, recuperação de senha, transições internas e histórico administrativo. Ela também verifica a rejeição de respostas incompatíveis, inclusive tokens ausentes, erros sem mensagem e campos anuláveis com tipo incorreto.
