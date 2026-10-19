export function requireValue(value, message = 'Solicitação não permitida') {
  if (!value) throw new Error(message);
}

export function config(env = process.env) {
  const list = (name, pattern) => {
    const entries = (env[name] || '').split(',').map(s => s.trim()).filter(Boolean);
    requireValue(entries.length <= 100 && entries.every(s => pattern.test(s)), `Configuração inválida: ${name}`);
    return Object.freeze([...new Set(entries)]);
  };
  const properties = list('GA4_ALLOWED_PROPERTY_IDS', /^[1-9]\d{0,19}$/);
  const containers = list('GTM_ALLOWED_CONTAINERS', /^accounts\/[1-9]\d{0,19}\/containers\/[1-9]\d{0,19}$/);
  const customers = list('GOOGLE_ADS_ALLOWED_CUSTOMER_IDS', /^\d{10}$/);
  const loginCustomer = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '';
  requireValue(!loginCustomer || /^\d{10}$/.test(loginCustomer), 'Login customer inválido');
  const adsVersion = env.GOOGLE_ADS_API_VERSION || 'v24';
  requireValue(/^v[1-9]\d{0,2}$/.test(adsVersion), 'Versão Ads inválida');
  // Credentials stay outside the public configuration and tool responses.
  return Object.freeze({ properties, containers, customers, loginCustomer, adsVersion });
}
