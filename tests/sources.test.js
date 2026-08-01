import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leadsCount } from '../src/sources/ghl.js';
import { parseMetaAmount, dailySpend, monthlySpend, campaignInsights, metaFetch } from '../src/sources/meta.js';
import { listSocialAccounts, socialStats } from '../src/sources/ghlSocial.js';

test('parseMetaAmount limpia "$4,500.00 MXN" a 4500', () => {
  assert.equal(parseMetaAmount('$4,500.00 MXN'), 4500);
});

test('leadsCount devuelve meta.total', async () => {
  const mock = async () => ({ ok: true, json: async () => ({ data: { meta: { total: 421 } } }) });
  const n = await leadsCount('t', 'loc', 'pipe', '06-13-2026', '06-19-2026', mock);
  assert.equal(n, 421);
});

test('dailySpend mapea spend a number', async () => {
  const mock = async () => ({
    ok: true,
    json: async () => ({
      data: [
        { date_start: '2026-06-01', spend: '100.50' },
        { date_start: '2026-06-02', spend: '200.75' }
      ]
    })
  });
  const result = await dailySpend('token', 'acc', '2026-06-01', '2026-06-30', mock);
  assert.deepEqual(result, [
    { date: '2026-06-01', spend: 100.5 },
    { date: '2026-06-02', spend: 200.75 }
  ]);
});

test('monthlySpend mapea date_start a month y spend a number', async () => {
  const mock = async () => ({
    ok: true,
    json: async () => ({
      data: [
        { date_start: '2026-01-01', spend: '1500.00' },
        { date_start: '2026-02-01', spend: '2000.50' }
      ]
    })
  });
  const result = await monthlySpend('token', 'acc', '2026-01-01', '2026-02-28', mock);
  assert.deepEqual(result, [
    { month: '2026-01', spend: 1500 },
    { month: '2026-02', spend: 2000.5 }
  ]);
});

test('campaignInsights parsea ROAS/purchases por campaña y pagina', async () => {
  let calls = 0;
  const urls = [];
  const mock = async (url) => {
    urls.push(url);
    calls++;
    if (calls === 1) return { ok: true, json: async () => ({
      data: [{ campaign_name: 'Prospecting', spend: '4500.00', ctr: '2.88', cpc: '1.72',
               purchase_roas: [{ action_type: 'omni_purchase', value: '2.03' }],
               actions: [{ action_type: 'omni_purchase', value: '3' }] }],
      paging: { next: 'https://graph.facebook.com/next' } }) };
    return { ok: true, json: async () => ({
      data: [{ campaign_name: 'Retargeting', spend: '900.00', ctr: '1.20', cpc: '2.10',
               purchase_roas: [], actions: [] }] }) };
  };
  const r = await campaignInsights('T', '123', 'last_7d', mock);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { name: 'Prospecting', spend: 4500, roas: 2.03, purchases: 3, ctr: 2.88, cpc: 1.72 });
  assert.deepEqual(r[1], { name: 'Retargeting', spend: 900, roas: 0, purchases: 0, ctr: 1.2, cpc: 2.1 });
  assert.equal(calls, 2);
  assert.equal(urls[1], 'https://graph.facebook.com/next');
});

test('metaFetch reintenta en 503 con backoff y devuelve la respuesta al recuperarse', async () => {
  let calls = 0;
  const waits = [];
  const mock = async () => (++calls < 3 ? { ok: false, status: 503 } : { ok: true, status: 200 });
  const sleepImpl = async ms => { waits.push(ms); };
  const res = await metaFetch('https://x', mock, sleepImpl);
  assert.equal(res.ok, true);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [500, 1000]);
});

test('metaFetch reintenta en 403 (rate limit transitorio de Meta)', async () => {
  let calls = 0;
  const mock = async () => (++calls < 2 ? { ok: false, status: 403 } : { ok: true, status: 200 });
  const res = await metaFetch('https://x', mock, async () => {});
  assert.equal(res.ok, true);
  assert.equal(calls, 2);
});

test('metaFetch NO reintenta en 400 (error permanente) y lanza Meta 400', async () => {
  let calls = 0;
  const mock = async () => { calls++; return { ok: false, status: 400 }; };
  await assert.rejects(() => metaFetch('https://x', mock, async () => {}), /Meta 400/);
  assert.equal(calls, 1);
});

test('metaFetch agota los reintentos y lanza el último error', async () => {
  let calls = 0;
  const mock = async () => { calls++; return { ok: false, status: 503 }; };
  await assert.rejects(() => metaFetch('https://x', mock, async () => {}), /Meta 503/);
  assert.equal(calls, 3);
});

test('dailySpend sobrevive un 503 transitorio de Meta', async () => {
  let calls = 0;
  const mock = async () => (++calls === 1
    ? { ok: false, status: 503 }
    : { ok: true, json: async () => ({ data: [{ date_start: '2026-07-01', spend: '50.00' }] }) });
  const result = await dailySpend('token', 'acc', '2026-07-01', '2026-07-31', mock);
  assert.deepEqual(result, [{ date: '2026-07-01', spend: 50 }]);
  assert.equal(calls, 2);
});

test('listSocialAccounts extrae profileId/platform/name', async () => {
  const mock = async () => ({ ok: true, json: async () => ({
    data: { results: { accounts: [
      { profileId: 'p1', platform: 'instagram', name: 'gaboleal' },
      { profileId: 'p2', platform: 'tiktok', name: 'gabo.leal' } ] } } }) });
  const r = await listSocialAccounts('T', 'loc', mock);
  assert.deepEqual(r, [
    { profileId: 'p1', platform: 'instagram', name: 'gaboleal' },
    { profileId: 'p2', platform: 'tiktok', name: 'gabo.leal' } ]);
});

test('socialStats hace POST con locationId en query y lee results de la raíz (REST)', async () => {
  let captured;
  const mock = async (url, opts) => { captured = { url, opts }; return { ok: true, json: async () => ({ results: { totals: { followers: 174 } } }) }; };
  const r = await socialStats('T', 'loc123', ['p1'], ['instagram'], mock);
  assert.equal(r.totals.followers, 174);
  assert.equal(captured.opts.method, 'POST');
  assert.match(captured.url, /locationId=loc123/);
  assert.deepEqual(JSON.parse(captured.opts.body), { profileIds: ['p1'], platforms: ['instagram'] });
});
