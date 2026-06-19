import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cdmxDayKey, windows } from '../src/lib/dates.js';

test('cdmxDayKey corre una venta nocturna UTC al día CDMX correcto', () => {
  // 2026-06-19 03:00 UTC === 2026-06-18 21:00 CDMX
  const epoch = Date.UTC(2026, 5, 19, 3, 0, 0) / 1000;
  assert.equal(cdmxDayKey(epoch), '2026-06-18');
});

test('windows divide en 7d y 7d previos sin solape', () => {
  const now = Date.UTC(2026, 5, 19, 18, 0, 0) / 1000;
  const w = windows(now);
  assert.equal(w.prev7.end, w.last7.start); // contiguos
  assert.equal(w.prev7.end - w.prev7.start, 7 * 86400); // ventana previa = exactamente 7 días
  assert.ok(w.last7.end > w.last7.start);
});
