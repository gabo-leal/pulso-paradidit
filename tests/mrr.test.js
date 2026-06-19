import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mrrFromStripeSubs, mrrFromGhlTransactions } from '../src/metrics/mrr.js';

test('MRR de subs Stripe suma normalizando anuales', () => {
  const subs = [
    { items: { data: [{ quantity: 1, price: { unit_amount: 30000, currency: 'mxn', recurring: { interval: 'month', interval_count: 1 } } }] } },
    { items: { data: [{ quantity: 1, price: { unit_amount: 360000, currency: 'mxn', recurring: { interval: 'month', interval_count: 12 } } }] } }
  ];
  const r = mrrFromStripeSubs(subs);
  assert.equal(r.count, 2);
  assert.equal(r.mxn, 600); // 300 + 300
});

test('MRR GHL reconstruye solo recurrentes con cobro reciente', () => {
  const now = Date.UTC(2026, 5, 19, 12, 0, 0) / 1000;
  const recent = now - 5 * 86400;
  const old = now - 90 * 86400;
  const txs = [
    { status: 'succeeded', subscriptionId: 'sub_a', amount: 397, createdAt: new Date(recent * 1000).toISOString() },
    { status: 'succeeded', subscriptionId: 'sub_a', amount: 397, createdAt: new Date((recent - 30 * 86400) * 1000).toISOString() }, // mismo sub, no duplica
    { status: 'succeeded', subscriptionId: 'sub_b', amount: 249, createdAt: new Date(old * 1000).toISOString() }, // viejo => inactivo
    { status: 'succeeded', subscriptionId: null, amount: 600, createdAt: new Date(recent * 1000).toISOString() } // pago único => ignora
  ];
  const r = mrrFromGhlTransactions(txs, now);
  assert.equal(r.count, 1);   // solo sub_a
  assert.equal(r.mxn, 397);
});
