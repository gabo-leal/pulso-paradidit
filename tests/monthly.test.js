import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyReport } from '../src/metrics/monthly.js';

test('monthlyReport agrupa por mes y calcula resultado', () => {
  const ghlTx = [
    { status: 'succeeded', amount: 40, createdAt: '2026-03-10T12:00:00Z' },
    { status: 'succeeded', amount: 7631, createdAt: '2026-04-05T12:00:00Z' }
  ];
  const lwCharges = [
    { paid: true, status: 'succeeded', amount: 4141100, created: Date.UTC(2026,0,15)/1000 } // ene, $41,411
  ];
  const adsByMonth = [{ month: '2026-01', spend: 9104 }, { month: '2026-04', spend: 6101 }];
  const { rows, total } = monthlyReport({ ghlTx, lwCharges, adsByMonth });
  const ene = rows.find(r => r.mes === '2026-01');
  assert.equal(ene.lw, 41411);
  assert.equal(ene.resultado, 41411 - 9104);
  const abr = rows.find(r => r.mes === '2026-04');
  assert.equal(abr.ingresos, 7631);
  assert.equal(total.ingresos, 41411 + 40 + 7631);
});
