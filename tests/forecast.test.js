import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proyectarMrr } from '../src/metrics/forecast.js';

const base = { subsIniciales: 10, trialsMes: 20, conversionPct: 50, churnPct: 10, precio: 349 };

test('devuelve 6 filas por default, mes 1..6', () => {
  const rows = proyectarMrr(base);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map(r => r.mes), [1, 2, 3, 4, 5, 6]);
});

test('mes 1: nuevos, subs, mrr y delta contra el MRR inicial implícito', () => {
  const [m1] = proyectarMrr(base);
  assert.equal(m1.nuevos, 10);          // 20 × 50%
  assert.equal(m1.subs, 19);            // 10 × 0.9 + 10
  assert.equal(m1.mrr, 19 * 349);       // 6631
  assert.equal(m1.delta, 6631 - 3490);  // vs subsIniciales × precio
});

test('sin churn el crecimiento es lineal: subs_m = iniciales + m × nuevos', () => {
  const rows = proyectarMrr({ ...base, churnPct: 0 });
  rows.forEach(r => {
    assert.equal(r.subs, 10 + r.mes * 10);
    assert.equal(r.mrr, (10 + r.mes * 10) * 349);
  });
  // delta constante = nuevos × precio
  assert.ok(rows.every(r => r.delta === 10 * 349));
});

test('con churn la serie converge: creciente bajo el techo, sin rebasarlo', () => {
  // techo de subs = nuevos / churn = 10 / 0.1 = 100
  const rows = proyectarMrr(base);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].subs > rows[i - 1].subs);
  assert.ok(rows[rows.length - 1].subs < 100);
});

test('arrancando exactamente en el techo la serie es constante (delta 0)', () => {
  const rows = proyectarMrr({ ...base, subsIniciales: 100 });
  rows.forEach(r => {
    assert.equal(r.subs, 100);
    assert.equal(r.delta, 0);
  });
});

test('acumulado: suma corriente del MRR mes a mes', () => {
  const rows = proyectarMrr({ ...base, churnPct: 0 });
  // sin churn: mrr_m = (10 + 10m)×349 → acumulado_m = Σ
  let suma = 0;
  rows.forEach(r => {
    suma += r.mrr;
    assert.equal(r.acumulado, suma);
  });
  assert.equal(rows[0].acumulado, rows[0].mrr);
});

test('inputs cero: todas las filas en 0', () => {
  const rows = proyectarMrr({ subsIniciales: 0, trialsMes: 0, conversionPct: 0, churnPct: 5, precio: 349 });
  rows.forEach(r => {
    assert.equal(r.nuevos, 0);
    assert.equal(r.subs, 0);
    assert.equal(r.mrr, 0);
    assert.equal(r.delta, 0);
    assert.equal(r.acumulado, 0);
  });
});

test('sanitiza: NaN y negativos → 0; churn se acota a 100', () => {
  const rows = proyectarMrr({ subsIniciales: NaN, trialsMes: -5, conversionPct: 50, churnPct: 150, precio: 349 });
  // churn 100%: cada mes sobreviven 0 previos; trials -5 → 0 nuevos
  rows.forEach(r => {
    assert.equal(r.subs, 0);
    assert.equal(r.mrr, 0);
  });
  // churn 100 con trials válidos: subs = solo los nuevos de cada mes
  const rows2 = proyectarMrr({ subsIniciales: 40, trialsMes: 20, conversionPct: 50, churnPct: 150, precio: 349 });
  rows2.forEach(r => assert.equal(r.subs, 10));
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
