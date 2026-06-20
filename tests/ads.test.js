import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignBreakdown } from '../src/metrics/ads.js';

test('campaignBreakdown ordena, calcula CPA y marca mejor/peor/fatiga', () => {
  const camps = [
    { name: 'A', spend: 4500, roas: 2.0, purchases: 3, ctr: 3.0, cpc: 1.7 },
    { name: 'B', spend: 900,  roas: 0.5, purchases: 1, ctr: 0.8, cpc: 2.1 }, // ctr bajo → fatiga
    { name: 'C', spend: 1500, roas: 1.2, purchases: 0, ctr: 2.5, cpc: 1.9 }, // sin compras → cpa 0
  ];
  const r = campaignBreakdown(camps);
  assert.deepEqual(r.rows.map(x => x.nombre), ['A', 'C', 'B']); // por gasto desc
  assert.equal(r.rows.find(x => x.nombre === 'A').cpa, 1500);   // 4500/3
  assert.equal(r.rows.find(x => x.nombre === 'C').cpa, 0);
  assert.equal(r.mejor, 'A');
  assert.equal(r.peor, 'B');
  // avgCtr = (3.0+0.8+2.5)/3 = 2.1; fatiga si ctr < 1.47 → solo B
  assert.equal(r.rows.find(x => x.nombre === 'B').fatiga, true);
  assert.equal(r.rows.find(x => x.nombre === 'A').fatiga, false);
});

test('campaignBreakdown con lista vacía no rompe', () => {
  const r = campaignBreakdown([]);
  assert.deepEqual(r, { rows: [], mejor: null, peor: null });
});
