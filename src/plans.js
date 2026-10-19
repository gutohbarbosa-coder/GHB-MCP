import { schemas } from './schemas.js';
import { requireValue } from './config.js';

const GTM = 'https://tagmanager.googleapis.com/tagmanager/v2/';
const id = value => { requireValue(typeof value === 'string' && /^\d+$/.test(value), 'ID numérico inválido'); return value; };
const allowed = (list, value) => requireValue(list.includes(value), 'Recurso fora da lista autorizada');
const collection = '(tags|triggers|variables|folders)';
export function readPlan(cfg, tool, input) {
  const args = schemas[tool]?.parse(input);
  requireValue(args, 'Ferramenta não permitida');
  if (tool === 'gtm_read') {
    requireValue(new RegExp('^accounts/\\d+/containers/\\d+(?:/(?:workspaces(?:/\\d+(?:/(?:status|' + collection + '(?:/\\d+)?))?)?|version_headers|versions/\\d+))?$').test(args.path), 'Caminho GTM de leitura inválido');
    allowed(cfg.containers, args.path.split('/').slice(0,4).join('/'));
    const url = new URL(GTM + args.path);
    if (args.pageToken) url.searchParams.set('pageToken', args.pageToken);
    return { service:'gtm', method:'GET', url:url.href };
  }
  if (tool === 'ga4_report') {
    allowed(cfg.properties, id(args.propertyId));
    requireValue(Array.isArray(args.metrics) && args.metrics.length > 0 && args.metrics.length <= 10, 'Informe de 1 a 10 métricas');
    requireValue(Array.isArray(args.dimensions) && args.dimensions.length <= 9, 'Dimensões inválidas');
    [...args.metrics, ...args.dimensions].forEach(n => requireValue(/^[a-zA-Z][a-zA-Z0-9_:]{0,100}$/.test(n), 'Nome inválido'));
    for (const date of [args.startDate,args.endDate]) requireValue(/^(\d{4}-\d{2}-\d{2}|today|yesterday|\d{1,4}daysAgo)$/.test(date), 'Data inválida');
    requireValue(Number.isInteger(args.limit) && args.limit >= 1 && args.limit <= 1000, 'Limite inválido');
    return { service:'ga4', method:'POST', url:'https://analyticsdata.googleapis.com/v1beta/properties/'+args.propertyId+':runReport', body:{ dateRanges:[{startDate:args.startDate,endDate:args.endDate}], metrics:args.metrics.map(name=>({name})), dimensions:args.dimensions.map(name=>({name})), limit:String(args.limit), ...(args.offset ? {offset:args.offset} : {}) } };
  }
  if (tool === 'ga4_admin_read') {
    allowed(cfg.properties, id(args.propertyId));
    requireValue(['property','dataStreams','keyEvents','customDimensions','customMetrics'].includes(args.resource), 'Recurso GA4 inválido');
    const url = new URL('https://analyticsadmin.googleapis.com/v1beta/properties/'+args.propertyId+(args.resource==='property'?'':'/'+args.resource));
    if(args.pageToken) url.searchParams.set('pageToken',args.pageToken);
    return {service:'ga4',method:'GET',url:url.href};
  }
  if (tool === 'google_ads_search') {
    allowed(cfg.customers, id(args.customerId));
    requireValue(/^SELECT\s/i.test(args.query.trim()) && args.query.length <= 12000 && !args.query.includes(';'), 'Use uma única consulta SELECT GAQL');
    const version = cfg.adsVersion;
    requireValue(/^v\d+$/.test(version), 'Versão Ads inválida');
    return {service:'ads',method:'POST',url:'https://googleads.googleapis.com/'+version+'/customers/'+args.customerId+'/googleAds:search',body:{query:args.query,...(args.pageToken?{pageToken:args.pageToken}:{})}};
  }
  throw new Error('Ferramenta não permitida');
}
