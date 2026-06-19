import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yearTotals } from '../src/metrics/year.js';

test('yearTotals suma fuentes y calcula resultado/ROAS', () => {
  const r = yearTotals({ ingresosGhl: 45153, ingresosLW: 112250, gastoAds: 78858 });
  assert.equal(r.ingresos, 157403);
  assert.equal(r.gasto, 78858);
  assert.equal(r.resultado, 78545);
  assert.equal(r.roasAnual, 2.00);
});
