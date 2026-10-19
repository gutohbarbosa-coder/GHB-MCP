import { pathToFileURL } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from './src/config.js';
import { Google } from './src/google.js';
import { createServer } from './src/mcp.js';

export async function start(env = process.env) {
  const cfg = config(env);
  const google = new Google(cfg, { token: env.GOOGLE_ACCESS_TOKEN || '' });
  const server = createServer(cfg, google);
  await server.connect(new StdioServerTransport());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch(() => { console.error('GHB MCP: falha na configuração ou transporte local.'); process.exitCode = 1; });
}
