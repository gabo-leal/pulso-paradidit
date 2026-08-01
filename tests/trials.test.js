import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trialsSummary, TRIAL_PRICE, FULL_PRICE, TRIAL_WINDOW_DAYS } from '../src/metrics/trials.js';
import { buildDonutSvg, buildSvg } from '../src/chart.js';

// Mismo "now" fijo que build.test.js
const now = Date.UTC(2026, 5, 19, 18, 0, 0) / 1000;
const DAY = 86400;

// tx de suscripción con offset en segundos hacia atrás desde now
const tx = (secsAgo, amount, status, subscriptionId, motivo) => ({
  amount,
  status,
  subscriptionId,
  createdAt: new Date((now - secsAgo) * 1000).toISOString(),
  ...(motivo !== undefined
    ? { chargeSnapshot: { last_payment_error: { decline_code: motivo } } }
    : {}),
});

test('renovó: $10 succeeded + $349 succeeded', () => {
  const r = trialsSummary([tx(40 * DAY, 10, 'succeeded', 's1'), tx(5 * DAY, 349, 'succeeded', 's1')], now);
  assert.equal(r.renovaron, 1);
  assert.equal(r.cohorte, 1);
  assert.equal(r.mrrGanado, 349);
});

test('renovó gana sobre error: failed 349 y luego succeeded 349', () => {
  const r = trialsSummary([
    tx(40 * DAY, 10, 'succeeded', 's1'),
    tx(6 * DAY, 349, 'failed', 's1', 'Your card was declined.'),
    tx(5 * DAY, 349, 'succeeded', 's1'),
  ], now);
  assert.equal(r.renovaron, 1);
  assert.equal(r.errorPago, 0);
});

test('error de pago cuenta 1 por sub aunque haya varios intentos, y suma enRiesgo', () => {
  const r = trialsSummary([
    tx(40 * DAY, 10, 'succeeded', 's1'),
    tx(6 * DAY, 349, 'failed', 's1', 'Your card was declined.'),
    tx(5 * DAY, 349, 'failed', 's1', 'Your card was declined.'),
  ], now);
  assert.equal(r.errorPago, 1);
  assert.equal(r.enRiesgo, 349);
});

test('abierto: $10 hace 5 días sin eventos de 349', () => {
  const r = trialsSummary([tx(5 * DAY, 10, 'succeeded', 's1')], now);
  assert.equal(r.abiertos, 1);
  assert.equal(r.cancelaron, 0);
});

test('canceló: $10 hace 40 días sin ningún evento de 349', () => {
  const r = trialsSummary([tx(40 * DAY, 10, 'succeeded', 's1')], now);
  assert.equal(r.cancelaron, 1);
  assert.equal(r.abiertos, 0);
});

test('edge: día 32 exacto es abierto; 32d+1s es cancelado', () => {
  const borde = trialsSummary([tx(TRIAL_WINDOW_DAYS * DAY, 10, 'succeeded', 's1')], now);
  assert.equal(borde.abiertos, 1);
  const pasado = trialsSummary([tx(TRIAL_WINDOW_DAYS * DAY + 1, 10, 'succeeded', 's1')], now);
  assert.equal(pasado.cancelaron, 1);
});

test('sub con $10 solo failed queda fuera de la cohorte', () => {
  const r = trialsSummary([tx(5 * DAY, 10, 'failed', 's1')], now);
  assert.equal(r.cohorte, 0);
});

test('$10 failed seguido de $10 succeeded entra a la cohorte y el reloj corre desde el succeeded', () => {
  const r = trialsSummary([
    tx(50 * DAY, 10, 'failed', 's1'),
    tx(5 * DAY, 10, 'succeeded', 's1'),
  ], now);
  assert.equal(r.cohorte, 1);
  assert.equal(r.abiertos, 1); // 5 días desde el succeeded, no 50 desde el failed
});

test('sub cuyo primer succeeded es 349 (compra directa) queda fuera de la cohorte', () => {
  const r = trialsSummary([tx(5 * DAY, 349, 'succeeded', 's1')], now);
  assert.equal(r.cohorte, 0);
});

test('tx sin subscriptionId se ignoran', () => {
  const r = trialsSummary([tx(5 * DAY, 10, 'succeeded', undefined)], now);
  assert.equal(r.cohorte, 0);
});

test('conversión excluye abiertos del denominador: 1R+1E+2C+5A → 25%', () => {
  const txs = [
    tx(40 * DAY, 10, 'succeeded', 'r1'), tx(5 * DAY, 349, 'succeeded', 'r1'),
    tx(40 * DAY, 10, 'succeeded', 'e1'), tx(5 * DAY, 349, 'failed', 'e1', 'Your card was declined.'),
    tx(40 * DAY, 10, 'succeeded', 'c1'),
    tx(41 * DAY, 10, 'succeeded', 'c2'),
    ...[1, 2, 3, 4, 5].map(i => tx(i * DAY, 10, 'succeeded', 'a' + i)),
  ];
  const r = trialsSummary(txs, now);
  assert.equal(r.conversion, 0.25);
  assert.equal(r.cohorte, 9);
});

test('cohorte vacía: todo 0 y conversion 0 (sin NaN)', () => {
  const r = trialsSummary([], now);
  assert.deepEqual(r, {
    cohorte: 0, renovaron: 0, errorPago: 0, abiertos: 0, cancelaron: 0,
    conversion: 0, mrrGanado: 0, enRiesgo: 0, motivosError: [],
  });
});

// ── motivosError ──────────────────────────────────────────────────────────────

test('motivosError mapea mensajes de Stripe a español y ordena desc', () => {
  const txs = [
    tx(40 * DAY, 10, 'succeeded', 'e1'), tx(5 * DAY, 349, 'failed', 'e1', 'Your card has insufficient funds.'),
    tx(40 * DAY, 10, 'succeeded', 'e2'), tx(5 * DAY, 349, 'failed', 'e2', 'Your card has insufficient funds.'),
    tx(40 * DAY, 10, 'succeeded', 'e3'), tx(5 * DAY, 349, 'failed', 'e3', 'Your card was declined.'),
  ];
  const r = trialsSummary(txs, now);
  assert.deepEqual(r.motivosError, [
    { motivo: 'Fondos insuficientes', count: 2 },
    { motivo: 'Tarjeta rechazada', count: 1 },
  ]);
});

test('motivosError usa el motivo del ÚLTIMO intento fallido de la sub', () => {
  const r = trialsSummary([
    tx(40 * DAY, 10, 'succeeded', 'e1'),
    tx(6 * DAY, 349, 'failed', 'e1', 'Your card was declined.'),
    tx(5 * DAY, 349, 'failed', 'e1', 'Your card has insufficient funds.'),
  ], now);
  assert.deepEqual(r.motivosError, [{ motivo: 'Fondos insuficientes', count: 1 }]);
});

test('failed sin last_payment_error cae en "Otro"', () => {
  const r = trialsSummary([
    tx(40 * DAY, 10, 'succeeded', 'e1'),
    tx(5 * DAY, 349, 'failed', 'e1'),
  ], now);
  assert.deepEqual(r.motivosError, [{ motivo: 'Otro', count: 1 }]);
});

test('la suma de motivosError es exactamente errorPago', () => {
  const txs = [
    tx(40 * DAY, 10, 'succeeded', 'e1'), tx(5 * DAY, 349, 'failed', 'e1', 'Your card was declined.'),
    tx(40 * DAY, 10, 'succeeded', 'e2'), tx(5 * DAY, 349, 'failed', 'e2'),
    tx(40 * DAY, 10, 'succeeded', 'r1'), tx(5 * DAY, 349, 'succeeded', 'r1'),
  ];
  const r = trialsSummary(txs, now);
  assert.equal(r.motivosError.reduce((s, m) => s + m.count, 0), r.errorPago);
});

// ── buildDonutSvg ─────────────────────────────────────────────────────────────

test('buildDonutSvg genera un svg con un segmento por motivo y leyenda con %', () => {
  const svg = buildDonutSvg([
    { motivo: 'Fondos insuficientes', count: 3 },
    { motivo: 'Tarjeta rechazada', count: 1 },
  ]);
  assert.match(svg, /<svg/);
  assert.match(svg, /Fondos insuficientes/);
  assert.match(svg, /Tarjeta rechazada/);
  assert.match(svg, /75%/);
  assert.match(svg, /25%/);
});

test('buildDonutSvg con un solo motivo produce un círculo completo válido', () => {
  const svg = buildDonutSvg([{ motivo: 'Otro', count: 5 }]);
  assert.match(svg, /<svg/);
  assert.match(svg, /Otro/);
  assert.match(svg, /100%/);
  assert.doesNotMatch(svg, /NaN/);
});

// Regresión: el <style> de un SVG inline aplica a TODO el documento. Un selector
// `circle{...}` sin scope en la gráfica principal pintaba la dona como disco sólido.
test('buildDonutSvg es inmune a CSS global: círculos con estilo inline', () => {
  const svg = buildDonutSvg([{ motivo: 'Otro', count: 2 }]);
  for (const c of svg.match(/<circle[^>]*>/g)) {
    assert.match(c, /style="[^"]*fill:none/, `círculo sin fill:none inline: ${c}`);
    assert.match(c, /style="[^"]*stroke:#/, `círculo sin stroke inline: ${c}`);
  }
});

test('el <style> de buildSvg no tiene selectores de elemento sin scope (fugan al documento)', () => {
  const svg = buildSvg({ '2026-07-01': 100 }, { '2026-07-01': 50 }, ['2026-07-01'], '2026-07-01');
  const styles = (svg.match(/<style>[\s\S]*?<\/style>/g) || []).join('');
  assert.doesNotMatch(styles, /(^|[\s,}])circle\s*\{/, 'selector "circle" sin clase fuga a toda la página');
});

test('constantes de negocio exportadas', () => {
  assert.equal(TRIAL_PRICE, 10);
  assert.equal(FULL_PRICE, 349);
  assert.equal(TRIAL_WINDOW_DAYS, 32);
});
