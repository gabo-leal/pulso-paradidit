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

// ── pasesAnuales (Pase Anual PRO: pago único de $1,997, vigencia 12 meses) ────
const nowP = Date.UTC(2026, 5, 19, 18, 0, 0) / 1000;
const DAYP = 86400;
const paseTx = (secsAgo, extra) => ({
  amount: 1997, status: 'succeeded', subscriptionId: null,
  entitySourceName: 'Pase Anual PRO',
  createdAt: new Date((nowP - secsAgo) * 1000).toISOString(),
  ...extra,
});

test('pasesAnuales cuenta cobros del Pase Anual dentro de 365 días, prorrateados /12', async () => {
  const { pasesAnuales } = await import('../src/metrics/mrr.js');
  const r = pasesAnuales([paseTx(30 * DAYP), paseTx(300 * DAYP)], nowP);
  assert.equal(r.count, 2);
  assert.equal(r.mxn, (1997 * 2) / 12);
});

test('pasesAnuales excluye vencidos (>365 días), fallidos y otros productos', async () => {
  const { pasesAnuales } = await import('../src/metrics/mrr.js');
  const r = pasesAnuales([
    paseTx(370 * DAYP),                                        // vencido
    paseTx(10 * DAYP, { status: 'failed' }),                   // fallido
    paseTx(10 * DAYP, { entitySourceName: 'Maestro del Bombo', amount: 1997 }), // otro producto
  ], nowP);
  assert.deepEqual(r, { mxn: 0, count: 0 });
});
