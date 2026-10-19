import { readPlan } from './plans.js';

const MAX_BYTES = 5 * 1024 * 1024;
export class Google {
  constructor(cfg, { token = '', fetchImpl = globalThis.fetch } = {}) {
    this.cfg = cfg;
    this.token = token;
    this.fetch = fetchImpl;
  }

  // Only a named tool plus validated arguments can reach the network.
  async read(tool, args) {
    const plan = readPlan(this.cfg, tool, args);
    if (!this.token || /[\s\x00-\x1f\x7f]/.test(this.token)) throw new Error('Credencial local ausente ou inválida');
    const headers = { Authorization: 'Bearer ' + this.token, 'Content-Type': 'application/json' };
    if (plan.service === 'ads' && this.cfg.loginCustomer) headers['login-customer-id'] = this.cfg.loginCustomer;
    const response = await this.fetch(plan.url, {
      method: plan.method, headers, body: plan.body ? JSON.stringify(plan.body) : undefined,
      redirect: 'error', signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('Consulta recusada pelo provedor');
    }
    if (!response.body) throw new Error('Resposta vazia');
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BYTES) throw new Error('Resposta excede o limite; reduza a consulta');
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel(); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
}
