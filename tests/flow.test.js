import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sumChargesInWindow, roas, cpa } from '../src/metrics/flow.js';

test('sumChargesInWindow suma solo lo que cae en la ventana', () => {
  const win = { start: 100, end: 200 };
  const items = [
    { e: 90, a: 5 },   // fuera (antes)
    { e: 100, a: 10 }, // dentro (inclusive start)
    { e: 199, a: 20 }, // dentro
    { e: 200, a: 40 }  // fuera (exclusive end)
  ];
  const s = sumChargesInWindow(items, win, x => x.e, x => x.a);
  assert.equal(s, 30);
});

test('roas y cpa manejan división por cero', () => {
  assert.equal(roas(4792, 4500), 1.06);
  assert.equal(roas(100, 0), 0);
  assert.equal(roas(9001, 9000), 1.00); // round-to-nearest: 1.0001.. -> 1.00 (ceil would give 1.01)
  assert.equal(cpa(4500, 20), 225);
  assert.equal(cpa(100, 0), 0);
});
