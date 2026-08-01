import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proyectarMrr } from '../src/metrics/forecast.js';

// Modelo base-MRR: mrr_m = mrr_{m-1}×(1−churn) + nuevos×precio
// (la base real combina LW + GHL con precios distintos; churnear el MRR evita
// asumir que todos pagan $349)
const base = { mrrInicial: 3490, subsIniciales: 10, trialsMes: 20, conversionPct: 50, churnPct: 10, precio: 349 };

test('devuelve 6 filas por default, mes 1..6', () => {
  const rows = proyectarMrr(base);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map(r => r.mes), [1, 2, 3, 4, 5, 6]);
});

test('mes 1: churnea el MRR base y suma los nuevos a precio pleno', () => {
  const [m1] = proyectarMrr(base);
  assert.equal(m1.nuevos, 10);               // 20 × 50%
  assert.equal(m1.mrr, 3490 * 0.9 + 10 * 349); // 6631
  assert.equal(m1.subs, 19);                 // 10 × 0.9 + 10 (referencia)
  assert.equal(m1.delta, 6631 - 3490);       // vs MRR inicial
});

test('sin churn el MRR crece lineal: mrrInicial + m × nuevos × precio', () => {
  const rows = proyectarMrr({ ...base, churnPct: 0 });
  rows.forEach(r => assert.equal(r.mrr, 3490 + r.mes * 10 * 349));
  assert.ok(rows.every(r => r.delta === 10 * 349));
});

test('con churn el MRR converge: creciente bajo el techo, sin rebasarlo', () => {
  // techo de MRR = nuevos × precio / churn = 3490 / 0.1 = 34900
  const rows = proyectarMrr(base);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].mrr > rows[i - 1].mrr);
  assert.ok(rows[rows.length - 1].mrr < 34900);
});

test('arrancando exactamente en el techo el MRR es constante (delta 0)', () => {
  const rows = proyectarMrr({ ...base, mrrInicial: 34900 });
  rows.forEach(r => {
    assert.equal(r.mrr, 34900);
    assert.equal(r.delta, 0);
  });
});

test('sin trials nuevos la base decae geométricamente', () => {
  const rows = proyectarMrr({ ...base, trialsMes: 0, mrrInicial: 1000 });
  rows.forEach(r => assert.ok(Math.abs(r.mrr - 1000 * 0.9 ** r.mes) < 1e-9));
  rows.forEach(r => assert.ok(r.delta < 0));
});

test('acumulado: suma corriente del MRR mes a mes', () => {
  const rows = proyectarMrr({ ...base, churnPct: 0 });
  let suma = 0;
  rows.forEach(r => {
    suma += r.mrr;
    assert.equal(r.acumulado, suma);
  });
});

test('inputs cero: todas las filas en 0', () => {
  const rows = proyectarMrr({ mrrInicial: 0, subsIniciales: 0, trialsMes: 0, conversionPct: 0, churnPct: 5, precio: 349 });
  rows.forEach(r => {
    assert.equal(r.nuevos, 0);
    assert.equal(r.subs, 0);
    assert.equal(r.mrr, 0);
    assert.equal(r.delta, 0);
    assert.equal(r.acumulado, 0);
  });
});

test('sanitiza: NaN y negativos → 0; churn se acota a 100', () => {
  const rows = proyectarMrr({ mrrInicial: NaN, subsIniciales: -3, trialsMes: -5, conversionPct: 50, churnPct: 150, precio: 349 });
  rows.forEach(r => assert.equal(r.mrr, 0));
  // churn 100 con trials válidos: cada mes solo queda el MRR de los nuevos
  const rows2 = proyectarMrr({ mrrInicial: 99999, subsIniciales: 40, trialsMes: 20, conversionPct: 50, churnPct: 150, precio: 349 });
  rows2.forEach(r => assert.equal(r.mrr, 10 * 349));
});

test('meses configurable y default 6 si falta o es inválido', () => {
  assert.equal(proyectarMrr({ ...base, meses: 3 }).length, 3);
  assert.equal(proyectarMrr({ ...base, meses: 0 }).length, 6);
});

// Guardas del truco toString→browser (la función viaja embebida en el template):
test('el fuente de proyectarMrr no contiene "{{" pegado (rompería render.js)', () => {
  assert.ok(!/\{\{\w/.test(proyectarMrr.toString()));
});

test('round-trip: el fuente evaluado sin scope del módulo produce la misma función', () => {
  const revived = new Function('return ' + proyectarMrr.toString())();
  assert.deepEqual(revived(base), proyectarMrr(base));
});
