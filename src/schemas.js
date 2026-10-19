import { z } from 'zod';

const id = z.string().regex(/^[1-9]\d{0,19}$/);
const pageToken = z.string().min(1).max(2000).optional();
const field = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_:]{0,100}$/);
const date = z.string().max(20).refine(s => {
  if (/^(today|yesterday|\d{1,4}daysAgo)$/.test(s)) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const parsed = new Date(s);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === s;
});

export const schemas = Object.freeze({
  gtm_read: z.strictObject({ path: z.string().min(1).max(250), pageToken }),
  ga4_report: z.strictObject({
    propertyId: id, startDate: date, endDate: date,
    metrics: z.array(field).min(1).max(10), dimensions: z.array(field).max(9).default([]),
    limit: z.number().int().min(1).max(1000).default(100),
    offset: z.string().regex(/^\d{1,12}$/).optional()
  }),
  ga4_admin_read: z.strictObject({
    propertyId: id, resource: z.enum(['property', 'dataStreams', 'keyEvents', 'customDimensions', 'customMetrics']), pageToken
  }),
  google_ads_search: z.strictObject({
    customerId: z.string().regex(/^\d{10}$/), query: z.string().min(1).max(12000), pageToken
  })
});
