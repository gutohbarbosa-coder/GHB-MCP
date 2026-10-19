import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { schemas } from './schemas.js';

const descriptions = {
  gtm_read: 'Lê container, workspaces, status, tags, triggers, variáveis, pastas e versões autorizados.',
  ga4_report: 'Consulta relatório GA4 autorizado, até 1000 linhas; offset permite paginação.',
  ga4_admin_read: 'Lê configurações de propriedade GA4 autorizada.',
  google_ads_search: 'Executa uma consulta SELECT GAQL em conta autorizada; aceita pageToken.'
};
const output = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: true };

export function createServer(cfg, google) {
  const server = new McpServer({ name: 'ghb-mcp', version: '0.1.0-rc.2' });
  server.registerTool('connection_info', {
    description: 'Mostra recursos explicitamente autorizados na configuração local.',
    inputSchema: z.strictObject({}), annotations: { ...annotations, openWorldHint: false }
  }, async () => output({
    ga4Properties: cfg.properties, gtmContainers: cfg.containers,
    adsCustomers: cfg.customers, writesEnabled: false, transport: 'stdio'
  }));
  for (const [name, schema] of Object.entries(schemas)) {
    server.registerTool(name, { description: descriptions[name], inputSchema: schema, annotations }, async args => {
      try { return output(await google.read(name, args)); }
      // Neither provider payloads nor validation input are reflected in errors.
      catch { return { isError: true, content: [{ type: 'text', text: 'Consulta indisponível. Confira configuração, permissões e limites no provedor.' }] }; }
    });
  }
  return server;
}
