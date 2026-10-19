import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { readPlan } from '../src/plans.js';
import { Google } from '../src/google.js';
import { createServer } from '../src/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Any accidental real request fails the test immediately.
globalThis.fetch = async () => { throw new Error('External network forbidden in tests'); };
const cfg = config({ GA4_ALLOWED_PROPERTY_IDS: '123', GTM_ALLOWED_CONTAINERS: 'accounts/1/containers/2', GOOGLE_ADS_ALLOWED_CUSTOMER_IDS: '0000000000' });
const path = 'accounts/1/containers/2/workspaces/3/tags/4';
const report = { propertyId: '123', startDate: '2026-01-01', endDate: '2026-01-31', metrics: ['sessions'] };
const ads = { customerId: '0000000000', query: 'SELECT campaign.id FROM campaign LIMIT 10' };

test('configuration validates every resource, has no tenant defaults, freezes allowlists', () => {
  const empty = config({});
  assert.deepEqual(empty.properties, []);
  assert.deepEqual(empty.containers, []);
  assert.deepEqual(empty.customers, []);
  assert.throws(() => empty.properties.push('123'));
  for (const env of [
    { GA4_ALLOWED_PROPERTY_IDS: '123,../456' }, { GTM_ALLOWED_CONTAINERS: 'accounts/1/containers/2?x=1' },
    { GOOGLE_ADS_ALLOWED_CUSTOMER_IDS: '123-456-7890' }, { GOOGLE_ADS_LOGIN_CUSTOMER_ID: 'x' },
    { GOOGLE_ADS_API_VERSION: 'v24/../../' }
  ]) assert.throws(() => config(env));
});

test('GTM fixed grammar rejects foreign resources, traversal, query injection and all write actions', () => {
  for (const suffix of ['', '/workspaces', '/workspaces/3', '/workspaces/3/status', '/workspaces/3/tags', '/workspaces/3/triggers/4', '/workspaces/3/variables', '/workspaces/3/folders', '/versions/4', '/version_headers']) {
    const plan = readPlan(cfg, 'gtm_read', { path: 'accounts/1/containers/2' + suffix });
    assert.equal(plan.method, 'GET');
    assert.equal(new URL(plan.url).hostname, 'tagmanager.googleapis.com');
  }
  for (const invalid of [path + ':publish', path + '?x=1', path + '/../4', path.replace('containers/2', 'containers/9'), 'https://example.com', path.replace('/tags/', '/tags/%2f'), path + '/permissions', path + '\n']) {
    assert.throws(() => readPlan(cfg, 'gtm_read', { path: invalid }));
  }
  for (const tool of ['gtm_propose_change', 'google_ads_propose_change', 'delete', 'publish', 'mutate', '__proto__']) {
    assert.throws(() => readPlan(cfg, tool, { action: 'create', path, body: {} }));
  }
  assert.throws(() => readPlan(cfg, 'gtm_read', { path, method: 'DELETE' }));
});

test('GA4 report validates limits, calendar dates, field names and authorized property', () => {
  const plan = readPlan(cfg, 'ga4_report', report);
  assert.equal(plan.url, 'https://analyticsdata.googleapis.com/v1beta/properties/123:runReport');
  assert.equal(plan.method, 'POST');
  assert.equal(plan.body.limit, '100');
  for (const changes of [{ propertyId: '999' }, { startDate: '2026-02-30' }, { limit: 1001 }, { offset: '-1' }, { metrics: [] }, { metrics: ['x?key=y'] }, { dimensions: Array(10).fill('date') }, { body: { mutate: true } }]) {
    assert.throws(() => readPlan(cfg, 'ga4_report', { ...report, ...changes }));
  }
  for (const resource of ['property', 'dataStreams', 'keyEvents', 'customDimensions', 'customMetrics']) {
    assert.equal(readPlan(cfg, 'ga4_admin_read', { propertyId: '123', resource }).method, 'GET');
  }
  assert.throws(() => readPlan(cfg, 'ga4_admin_read', { propertyId: '123', resource: 'delete' }));
});

test('Ads accepts SELECT only on fixed search endpoint and encodes pagination separately', () => {
  const plan = readPlan(cfg, 'google_ads_search', { ...ads, pageToken: 'a&b=c' });
  assert.equal(plan.url, 'https://googleads.googleapis.com/v24/customers/0000000000/googleAds:search');
  assert.equal(plan.body.pageToken, 'a&b=c');
  for (const query of ['DELETE FROM campaign', 'mutate', 'SELECT campaign.id FROM campaign; DROP', 'SELECT\n']) {
    assert.throws(() => readPlan(cfg, 'google_ads_search', { ...ads, query }));
  }
  assert.throws(() => readPlan(cfg, 'google_ads_search', { ...ads, customerId: '1111111111' }));
  const gtm = readPlan(cfg, 'gtm_read', { path, pageToken: 'a&b=c' });
  assert.equal(new URL(gtm.url).searchParams.get('pageToken'), 'a&b=c');
});

test('transport builds authorized requests only; no caller URL or credentials in response', async () => {
  const calls = [];
  const google = new Google(cfg, { token: 'test-only', fetchImpl: async (url, opts) => {
    calls.push({ url, opts }); return Response.json({ rows: [] });
  } });
  await google.read('ga4_report', report);
  await google.read('google_ads_search', ads);
  await google.read('gtm_read', { path });
  assert.deepEqual(calls.map(c => c.opts.method), ['POST', 'POST', 'GET']);
  assert(calls.every(c => c.opts.redirect === 'error' && c.opts.signal instanceof AbortSignal));
  assert(calls.every(c => c.opts.headers.Authorization === 'Bearer test-only'));
  await assert.rejects(() => google.read('google_ads_propose_change', ads));
  await assert.rejects(() => google.read('gtm_read', { path: 'https://example.com' }));
  assert.equal(calls.length, 3);
  await assert.rejects(() => new Google(cfg).read('gtm_read', { path }));
});

test('provider errors and oversized/invalid responses cannot leak raw payloads', async () => {
  const cases = [
    async () => new Response('private-provider-payload', { status: 403 }),
    async () => new Response('x'.repeat(5 * 1024 * 1024 + 1)),
    async () => new Response('not-json'),
    async () => { throw new Error('private-network-detail'); }
  ];
  for (const fetchImpl of cases) {
    await assert.rejects(() => new Google(cfg, { token: 'test-only', fetchImpl }).read('gtm_read', { path }));
  }
});

test('MCP handshake, exact five read tools, real adapter calls and denied mutation', async () => {
  const calls = [];
  const google = new Google(cfg, { token: 'test-only', fetchImpl: async (url, opts) => {
    calls.push({ url, opts }); return Response.json({ synthetic: true });
  } });
  const server = createServer(cfg, google);
  const client = new Client({ name: 'local-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  try {
    const tools = (await client.listTools()).tools;
    assert.deepEqual(tools.map(t => t.name).sort(), ['connection_info', 'ga4_admin_read', 'ga4_report', 'google_ads_search', 'gtm_read']);
    assert(tools.every(t => t.annotations.readOnlyHint && !t.annotations.destructiveHint));
    const info = await client.callTool({ name: 'connection_info', arguments: {} });
    assert.equal(JSON.parse(info.content[0].text).writesEnabled, false);
    for (const [name, args] of [['gtm_read', { path }], ['ga4_report', report], ['ga4_admin_read', { propertyId: '123', resource: 'property' }], ['google_ads_search', ads]]) {
      const result = await client.callTool({ name, arguments: args });
      assert.equal(JSON.parse(result.content[0].text).synthetic, true);
    }
    assert.equal(calls.length, 4);
    const denied = await client.callTool({ name: 'gtm_read', arguments: { path: 'accounts/9/containers/9' } });
    assert.equal(denied.isError, true);
    assert.equal(calls.length, 4);
    const mutation = await client.callTool({ name: 'gtm_propose_change', arguments: { path } });
    assert.equal(mutation.isError, true);
    const invalid = await client.callTool({ name: 'gtm_read', arguments: { path, secret: 'synthetic-input' } });
    assert.equal(invalid.isError, true);
  } finally { await client.close(); await server.close(); }
});

test('MCP sanitizes provider exceptions at tool boundary', async () => {
  const server = createServer(cfg, { read: async () => { throw new Error('synthetic-sensitive-detail'); } });
  const client = new Client({ name: 'error-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  try {
    const result = await client.callTool({ name: 'gtm_read', arguments: { path } });
    assert.equal(result.isError, true);
    assert(!JSON.stringify(result).includes('synthetic-sensitive-detail'));
  } finally { await client.close(); await server.close(); }
});

test('actual stdio process initializes and lists tools without credentials or APIs', async () => {
  const client = new Client({ name: 'stdio-test', version: '1' });
  const transport = new StdioClientTransport({
    command: process.execPath, args: ['server.js'], cwd: new URL('..', import.meta.url).pathname,
    env: { PATH: process.env.PATH, GOOGLE_ACCESS_TOKEN: '', GA4_ALLOWED_PROPERTY_IDS: '', GTM_ALLOWED_CONTAINERS: '', GOOGLE_ADS_ALLOWED_CUSTOMER_IDS: '' }, stderr: 'pipe'
  });
  await client.connect(transport);
  try {
    assert.equal((await client.listTools()).tools.length, 5);
    const result = await client.callTool({ name: 'connection_info', arguments: {} });
    assert.deepEqual(JSON.parse(result.content[0].text).adsCustomers, []);
  } finally { await client.close(); }
});
