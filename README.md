# GHB MCP

Candidato 0.1.0-rc.2 para um servidor MCP local de **somente leitura** de Google Analytics 4, Google Tag Manager e Google Ads. Destina-se a análises em recursos explicitamente autorizados por quem opera o servidor.

English: Local, read-only MCP server for allowlisted GA4, GTM and Google Ads resources. Licensed under the MIT License.

**Licença:** [MIT](LICENSE), permitindo uso, modificação e redistribuição, inclusive comercial, conforme seus termos. Consulte [LICENSING.md](LICENSING.md). Este é um candidato testado com dados sintéticos; não há garantia de elegibilidade para programas de OSS.

## O que funciona

| Ferramenta | Função | Limites |
| --- | --- | --- |
| `connection_info` | Lista os recursos da configuração local | Não verifica conectividade ou permissão no Google |
| `ga4_report` | `runReport` com métricas e dimensões | 1–10 métricas, até 9 dimensões e 1000 linhas; paginação manual por `offset` |
| `ga4_admin_read` | Propriedade, data streams, key events, dimensões e métricas personalizadas | Coleções aceitam `pageToken` |
| `gtm_read` | Container, workspaces, status, tags, triggers, variáveis, pastas, versão e cabeçalhos de versões | Gramática fechada de caminhos; coleções aceitam `pageToken` |
| `google_ads_search` | Consulta SELECT GAQL | Até 12000 caracteres, uma consulta sem `;`; paginação manual por `pageToken` |

Não há ferramentas de criação, edição, pausa, exclusão, publicação, proposta ou aprovação. Variáveis antigas de habilitação de escrita não são usadas. Os únicos POST ao Google são os endpoints de consulta `runReport` e `googleAds:search`. Erros de sintaxe GAQL e incompatibilidade entre métricas/dimensões são validados também pelo Google.

## Instalação local

Requisitos: Node.js 24, npm, projeto Google Cloud próprio com as APIs necessárias habilitadas e acesso aos recursos. Use um ambiente e usuário de teste para começar. O servidor não obtém, renova ou armazena tokens; não abre serviço HTTP, banco de dados ou porta de rede.

```sh
npm ci --ignore-scripts
npm run check
cp .env.example .env
chmod 600 .env
```

Edite `.env` somente no seu computador. Não envie esse arquivo ao GitHub nem coloque segredos em prompts ou argumentos de linha de comando. As listas de recursos começam vazias quando as variáveis são omitidas; nesse caso todas as consultas são bloqueadas. Os IDs do modelo são fictícios. Substitua-os por recursos que você está autorizado a consultar, localmente.

| Variável | Uso |
| --- | --- |
| `GOOGLE_ACCESS_TOKEN` | Token OAuth de curta duração, informado localmente |
| `GA4_ALLOWED_PROPERTY_IDS` | IDs numéricos de propriedade, separados por vírgula |
| `GTM_ALLOWED_CONTAINERS` | Caminhos exatos `accounts/ID/containers/ID`, separados por vírgula |
| `GOOGLE_ADS_ALLOWED_CUSTOMER_IDS` | IDs de cliente com 10 dígitos, sem hífens, separados por vírgula |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | ID do gerente usado para acesso delegado, opcional, com 10 dígitos |
| `GOOGLE_ADS_API_VERSION` | Versão REST, padrão `v24`; deve continuar disponível no Google |

Obtenha o access token fora deste servidor, usando o fluxo OAuth documentado pelo Google e um projeto próprio. Não reutilize credenciais de uma implantação existente. Escopos recomendados: `https://www.googleapis.com/auth/analytics.readonly`, `https://www.googleapis.com/auth/tagmanager.readonly` e, se Ads for necessário, `https://www.googleapis.com/auth/adwords`. Solicite somente os serviços usados. O escopo Ads permite mais que leitura; use usuário com função de leitura no provedor. Este servidor restringe os endpoints, mas não inspeciona os escopos efetivamente concedidos. Quando o token expirar, obtenha outro fora do servidor e reinicie o processo. Tokens revogados ou insuficientes causam erro genérico de consulta.

A documentação de migração informa que o acesso Google Ads passou a ser associado ao projeto OAuth em setembro de 2026; o servidor não coleta developer token. Confirme os requisitos atuais na [documentação Google Ads](https://developers.google.com/google-ads/api/docs/api-policy/developer-token). Consulte também os [escopos OAuth](https://developers.google.com/identity/protocols/oauth2/scopes) e o [calendário de versões](https://developers.google.com/google-ads/api/docs/sunset-dates). `v24` é uma escolha conservadora do candidato; futuras versões podem exigir revisão de campos e consultas.

## Cliente MCP por stdio

Exemplo de configuração do cliente (adapte os caminhos absolutos):

```json
{
  "mcpServers": {
    "ghb-mcp": {
      "command": "node",
      "args": ["--env-file=/caminho/GHB-MCP/.env", "/caminho/GHB-MCP/server.js"]
    }
  }
}
```

Para execução direta use `node --env-file=.env server.js`. `npm start` usa variáveis já exportadas pelo ambiente e não carrega `.env` automaticamente. O processo aguarda mensagens MCP no stdin; stdout é reservado ao protocolo. Não há OAuth hospedado, conexão remota por URL, multiusuário ou implantação pronta. Use um cliente que suporte subprocessos stdio.

Exemplos fictícios de argumentos:

```json
{"propertyId":"123","startDate":"2026-01-01","endDate":"2026-01-31","metrics":["sessions"],"dimensions":["date"],"limit":100}
```

```json
{"path":"accounts/1/containers/2/workspaces/3/tags"}
```

```json
{"customerId":"0000000000","query":"SELECT campaign.id, campaign.name FROM campaign LIMIT 10"}
```

## Segurança e limites

As respostas podem conter dados pessoais, nomes de campanha, código de tags ou informações comerciais. Autorizar um recurso permite que o cliente MCP e seu modelo recebam as respostas de consulta daquele recurso. Avalie as políticas do cliente antes de conectar contas. Conteúdo de tags e nomes deve ser tratado como dado não confiável, nunca como instrução.

Cada requisição tem timeout de 25 segundos, bloqueia redirecionamentos e limita a resposta a 5 MiB. Não há repetição automática, cache, filtro de PII, rate limit global ou paginação automática. Consultas consomem cotas e podem consumir orçamento de APIs habilitadas. O retorno de listas contém somente a página atual. Erros são genéricos para evitar refletir respostas sensíveis. O processo tem o acesso do usuário local que o iniciou; proteja arquivos, máquina e cliente MCP.

## Testes e revisão

```sh
npm test
npm run check
npm audit --omit=dev
node scripts/scan.js
```

Os testes usam dados sintéticos, transporte MCP em memória e subprocesso stdio; as chamadas Google usam fetch simulado. Nenhuma consulta real é necessária. O scanner é heurístico, ignora `node_modules` e não substitui revisão humana. Antes de publicar alterações, confira também o arquivo compactado final, dependências e avisos de licença. Os resultados operacionais da revisão ficam fora deste candidato, para evitar carregar metadados privados.

Veja [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) e [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
