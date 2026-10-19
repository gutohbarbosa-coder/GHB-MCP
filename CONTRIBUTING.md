# Contribuindo

Este projeto usa a licença MIT. Ao propor uma contribuição, confirme que tem autorização para disponibilizá-la sob essa licença. Não envie código ou dados de terceiros sem autorização. Consulte LICENSING.md.

Use Node.js 24, `npm ci --ignore-scripts` e `npm run check`. Os testes devem usar dados sintéticos e mocks de rede; não introduza testes que chamem contas reais. Para corrigir consultas, inclua teste que valide o endpoint e bloqueie recursos fora das listas. Preserve o contrato de somente leitura: não adicione operações de mutação, URLs arbitrárias nem escopos GTM de edição. Atualize documentação e exemplos quando mudar comportamento.

Não inclua `.env`, tokens, IDs reais, dados de cliente, logs ou capturas de telas de contas. Revise `npm audit --omit=dev`, licenças transitivas e o arquivo exato a publicar após alterações de dependências. Não execute `npm audit fix --force` sem compreender a mudança.

Ao abrir uma proposta, descreva o problema, comportamento final, limitações e testes realizados. Vulnerabilidades devem seguir SECURITY.md, sem detalhes sensíveis em issues públicas.
