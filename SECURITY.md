# Segurança

A linha 0.1 é um candidato; não há SLA de correções nem auditoria externa concluída. A superfície de rede aceita apenas endpoints fixos de consulta do Google e recursos das listas locais. Não existe operação de escrita exposta.

Não publique vulnerabilidades acompanhadas de tokens, IDs reais, logs de conta ou dados pessoais. Após a abertura do repositório, use o recurso privado **Report a vulnerability** do GitHub se estiver habilitado. Enquanto não houver canal privado publicado, solicite ao mantenedor um canal privado sem revelar os detalhes da falha. Não presuma que essa opção já esteja ativa.

Relate versões, passos de reprodução com dados fictícios, impacto e correção sugerida. Nunca teste em contas de terceiros. Se um token vazar, revogue-o no provedor e remova-o de todos os locais pertinentes; apagar um arquivo não invalida o segredo.

Operadores devem usar permissões de leitura no Google, token de curta duração, listas mínimas, `.env` protegido e cliente MCP confiável. A restrição de leitura no código não reduz por si só os poderes de um token roubado. Respostas podem conter informações sensíveis e instruções maliciosas embutidas em dados; a avaliação desse conteúdo pertence também ao cliente.
