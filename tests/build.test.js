// pulso/tests/build.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assemble, deltaTxt } from '../src/build.js';
import { render } from '../src/render.js';

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

test('assemble produce todas las claves del template (43) sin undefined', () => {
  const data = assemble(fixture, now);

  // Las 43 claves que el template requiere
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
    'TRIAL_COHORTE', 'TRIAL_RENOVARON', 'TRIAL_ERROR', 'TRIAL_ABIERTOS', 'TRIAL_CANCELARON',
    'TRIAL_CONVERSION', 'TRIAL_CONVERSION_POT', 'TRIAL_MRR_GANADO', 'TRIAL_EN_RIESGO', 'TRIAL_DONA_SVG',
  ];

  for (const k of claves) {
    assert.ok(data[k] !== undefined, `falta clave: ${k}`);
  }
  assert.equal(claves.length, 44, 'el test cubre las 44 claves');
});

test('claves TRIAL_* se calculan desde ghlTxYear (incluye tx fallidas)', () => {
  const iso = secsAgo => new Date((now - secsAgo) * 1000).toISOString();
  const DAY = 86400;
  const data = assemble({
    ...fixture,
    ghlTxYear: [
      // renovó
      { amount: 10, status: 'succeeded', subscriptionId: 'r1', createdAt: iso(40 * DAY) },
      { amount: 349, status: 'succeeded', subscriptionId: 'r1', createdAt: iso(5 * DAY) },
      // error de pago
      { amount: 10, status: 'succeeded', subscriptionId: 'e1', createdAt: iso(40 * DAY) },
      { amount: 349, status: 'failed', subscriptionId: 'e1', createdAt: iso(5 * DAY),
        chargeSnapshot: { last_payment_error: { decline_code: 'Your card has insufficient funds.' } } },
      // abierto
      { amount: 10, status: 'succeeded', subscriptionId: 'a1', createdAt: iso(3 * DAY) },
    ],
  }, now);
  assert.equal(data.TRIAL_COHORTE, '3');
  assert.equal(data.TRIAL_RENOVARON, '1');
  assert.equal(data.TRIAL_ERROR, '1');
  assert.equal(data.TRIAL_ABIERTOS, '1');
  assert.equal(data.TRIAL_CANCELARON, '0');
  assert.equal(data.TRIAL_CONVERSION, '50%');
  assert.equal(data.TRIAL_CONVERSION_POT, '100%'); // 1 renovó + 1 error, 0 cancelaron
  assert.equal(data.TRIAL_MRR_GANADO, '$349');
  assert.equal(data.TRIAL_EN_RIESGO, '$349');
  assert.match(data.TRIAL_DONA_SVG, /<svg/);
  assert.match(data.TRIAL_DONA_SVG, /Fondos insuficientes/);
});

test('TRIAL_DONA_SVG muestra mensaje sin dona cuando no hay errores de pago', () => {
  const data = assemble(fixture, now);
  assert.doesNotMatch(data.TRIAL_DONA_SVG, /<svg/);
  assert.match(data.TRIAL_DONA_SVG, /Sin errores de pago/);
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

test('render(template, assemble(fixture)) no lanza — todo {{marcador}} cubierto (caso degradado social=[] campaigns=[])', () => {
  const tpl = readFileSync(new URL('../templates/pulso.template.html', import.meta.url), 'utf8');
  const data = assemble({ ...fixture, social: [], campaigns: [] }, now);
  assert.doesNotThrow(() => render(tpl, data), 'render lanzó: algún marcador del template no está cubierto por assemble');
});

test('assemble produce los marcadores de Redes y Ads', () => {
  const now = Date.UTC(2026, 5, 19, 18, 0, 0) / 1000;
  const data = assemble({ stripeSubs: [], stripeCharges: [], stripeChargesYear: [], ghlTx: [], ghlTxYear: [],
    leads7d: 0, leadsPrev: 0, metaDaily: [], metaSpendYear: 0, adsByMonth: [], churnMes: 0, churnTotal: 0,
    social: [{ platform: 'instagram', impressions: 60723, impressionsChange: 205.92, reach: 39900, reachChange: 273.98, engagement: 673, engagementChange: 154.92, followersGrowth: 174 }],
    campaigns: [{ name: 'A', spend: 4500, roas: 2.0, purchases: 3, ctr: 3.0, cpc: 1.7 }] }, now);
  assert.ok(data.REDES_CARDS.includes('instagram') || data.REDES_CARDS.includes('Instagram'));
  assert.ok(data.ADS_TBODY.includes('<tr>'));
  assert.notEqual(data.ADS_RESUMEN, undefined);
});

// ── deltaTxt unit tests ──────────────────────────────────────────────────────
test('deltaTxt: prev=0 cur>0 devuelve "nuevo"', () => {
  assert.equal(deltaTxt(500, 0), 'nuevo');
});

test('deltaTxt: prev=0 cur=0 devuelve "0%"', () => {
  assert.equal(deltaTxt(0, 0), '0%');
});

test('deltaTxt: prev>0 cur>prev devuelve porcentaje positivo', () => {
  assert.equal(deltaTxt(200, 100), '+100%');
});

test('deltaTxt: prev>0 cur<prev devuelve porcentaje negativo', () => {
  assert.equal(deltaTxt(50, 100), '-50%');
});

// ── ING_PILL con semana previa = 0 ──────────────────────────────────────────
test('ING_PILL dice "nuevo" cuando prev=0 y cur>0', () => {
  // now = 2026-06-19 18:00 UTC. last7 window starts 2026-06-12 18:00 UTC.
  // We put a tx in last7 only (prev7 window is 2026-06-05..2026-06-12 — leave it empty).
  const rawPrevZero = {
    ...fixture,
    ghlTx: [
      { status: 'succeeded', createdAt: '2026-06-14T12:00:00-06:00', amount: 1500 },
    ],
    ghlTxYear: [
      { status: 'succeeded', createdAt: '2026-06-14T12:00:00-06:00', amount: 1500 },
    ],
  };
  const data = assemble(rawPrevZero, now);
  assert.ok(data.ING_PILL.includes('nuevo'), `ING_PILL debería contener "nuevo", got: ${data.ING_PILL}`);
  assert.ok(!data.ING_PILL.includes('+0%'), `ING_PILL NO debería contener "+0%", got: ${data.ING_PILL}`);
});
