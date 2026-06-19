// pulso/tests/build.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemble } from '../src/build.js';

// Fixed "now": 2026-06-19 18:00:00 UTC-6 (midnight CDMX = 06:00 UTC next day)
const now = Date.UTC(2026, 5, 19, 18, 0, 0) / 1000;

const fixture = {
  stripeSubs:        [],
  stripeCharges:     [],
  stripeChargesYear: [],
  ghlTx:             [],
  ghlTxYear:         [],
  leads7d:           421,
  leadsPrev:         267,
  metaDaily:         [],
  metaSpendYear:     78858,
  adsByMonth:        [],
  churnMes:          2,
  churnTotal:        15,
};

test('assemble produce todas las claves del template (34) sin undefined', () => {
  const data = assemble(fixture, now);

  // Las 34 claves que el template requiere
  const claves = [
    'ACTUALIZADO',
    'ANIO_INGRESOS', 'ANIO_DESGLOSE', 'ANIO_GASTO', 'ANIO_RESULTADO', 'ANIO_ROAS',
    'H_ING', 'H_ING_PREV', 'H_VENTAS', 'H_VENTAS_PREV', 'H_LEADS', 'H_LEADS_PREV', 'H_GASTO', 'H_GASTO_PREV',
    'ING_7D', 'ING_PREV', 'MTD', 'ING_PILL',
    'MRR', 'MRR_DESGLOSE', 'CHURN', 'CHURN_HIST',
    'GASTO_7D', 'GASTO_PREV', 'GASTO_PILL',
    'ROAS_7D', 'ROAS_PREV', 'ROAS_PILL',
    'CPA_7D', 'CPA_PREV', 'CPA_PILL',
    'GRAFICO_SVG',
    'REPORTE_TBODY', 'REPORTE_TFOOT',
  ];

  for (const k of claves) {
    assert.ok(data[k] !== undefined, `falta clave: ${k}`);
  }
  assert.equal(claves.length, 34, 'el test cubre las 34 claves');
});

test('LEADS_7D proviene de raw.leads7d', () => {
  const data = assemble(fixture, now);
  assert.equal(data.H_LEADS, '421');
});

test('REPORTE_TBODY está definido (puede ser string vacío con datos vacíos)', () => {
  const data = assemble(fixture, now);
  assert.ok(data.REPORTE_TBODY !== undefined);
});

test('ING_PILL contiene clase pill', () => {
  const data = assemble(fixture, now);
  assert.ok(data.ING_PILL.includes('pill'), `ING_PILL: ${data.ING_PILL}`);
});

test('CHURN y CHURN_HIST reflejan raw.churnMes y raw.churnTotal', () => {
  const data = assemble(fixture, now);
  assert.equal(data.CHURN, '2');
  assert.equal(data.CHURN_HIST, '15');
});

test('GRAFICO_SVG contiene SVG válido', () => {
  const data = assemble(fixture, now);
  // Con datos vacíos, debe devolver un SVG (aunque vacío)
  assert.ok(data.GRAFICO_SVG.startsWith('<svg'), `GRAFICO_SVG empieza con <svg`);
});

test('ANIO_ROAS es 0.00x cuando no hay gasto', () => {
  const data = assemble(fixture, now);
  // metaSpendYear=78858 pero ingresosGhl=ingresosLW=0 => ROAS=0
  assert.equal(data.ANIO_ROAS, '0.00x');
});

test('assemble con ghlTx con ventas calcula ingresos correctamente', () => {
  const rawWithTx = {
    ...fixture,
    ghlTx: [
      // Dentro del last7: 2026-06-14 (now - 5 dias)
      { status: 'succeeded', createdAt: '2026-06-14T12:00:00-06:00', amount: 1000 },
      { status: 'succeeded', createdAt: '2026-06-15T12:00:00-06:00', amount: 500 },
      // Fuera de ventana (prev7)
      { status: 'succeeded', createdAt: '2026-06-07T12:00:00-06:00', amount: 200 },
      // Fallida — no cuenta
      { status: 'failed', createdAt: '2026-06-14T12:00:00-06:00', amount: 300 },
    ],
    ghlTxYear: [
      { status: 'succeeded', createdAt: '2026-06-14T12:00:00-06:00', amount: 1000 },
      { status: 'succeeded', createdAt: '2026-06-15T12:00:00-06:00', amount: 500 },
      { status: 'succeeded', createdAt: '2026-06-07T12:00:00-06:00', amount: 200 },
    ],
  };
  const data = assemble(rawWithTx, now);
  // $1,500 de last7 GHL
  assert.equal(data.ING_7D, '$1,500');
  assert.equal(data.H_ING, '$1,500');
  assert.equal(data.H_VENTAS, '2');
});
