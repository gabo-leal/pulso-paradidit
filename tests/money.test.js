import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centsToMXN, monthlyFromStripeItem } from '../src/lib/money.js';

test('centsToMXN convierte y redondea', () => {
  assert.equal(centsToMXN(30000), 300);
});

test('anual cada 12 meses se normaliza a mensual (no infla 12x)', () => {
  // $3,600 cada 12 meses = $300/mes
  const m = monthlyFromStripeItem({ unit_amount: 360000, quantity: 1, interval: 'month', interval_count: 12 });
  assert.equal(m, 30000);
});

test('mensual simple se queda igual', () => {
  const m = monthlyFromStripeItem({ unit_amount: 39700, quantity: 1, interval: 'month', interval_count: 1 });
  assert.equal(m, 39700);
});

test('interval year se divide entre 12', () => {
  const m = monthlyFromStripeItem({ unit_amount: 120000, quantity: 1, interval: 'year', interval_count: 1 });
  assert.equal(m, 10000);
});
