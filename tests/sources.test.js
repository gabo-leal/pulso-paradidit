import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leadsCount } from '../src/sources/ghl.js';
import { parseMetaAmount, dailySpend, monthlySpend } from '../src/sources/meta.js';

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
