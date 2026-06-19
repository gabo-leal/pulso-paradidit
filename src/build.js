// pulso/src/build.js
import fs from 'node:fs';
import { windows, cdmxDayKey } from './lib/dates.js';
import { mrrFromStripeSubs, mrrFromGhlTransactions } from './metrics/mrr.js';
import { sumChargesInWindow, roas, cpa } from './metrics/flow.js';
import { yearTotals } from './metrics/year.js';
import { monthlyReport } from './metrics/monthly.js';
import { buildSvg } from './chart.js';
import { render } from './render.js';
import { listActiveSubs, listChargesSince, listCanceledSubs } from './sources/stripeLW.js';
import { listTransactions, leadsCount } from './sources/ghl.js';
import { dailySpend, monthlySpend } from './sources/meta.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
const peso = n => '$' + Math.round(n).toLocaleString('en-US');
const pct  = (a, b) => b ? Math.round(((a - b) / b) * 100) : 0;
// deltaTxt: returns 'nuevo' when prev=0 & cur>0 (avoids misleading "+0%")
export const deltaTxt = (cur, prev) =>
  prev === 0 ? (cur > 0 ? 'nuevo' : '0%') : `${cur - prev >= 0 ? '+' : ''}${pct(cur, prev)}%`;
const epochOf = iso => Date.parse(iso) / 1000;

function pill(cls, inner) {
  return `<span class="pill ${cls}">${inner}</span>`;
}

// ── assemble ──────────────────────────────────────────────────────────────────
// raw = {
//   stripeSubs, stripeCharges, stripeChargesYear,
//   ghlTx, ghlTxYear,
//   leads7d, leadsPrev,
//   metaDaily, metaSpendYear,
//   adsByMonth,          // array [{month, spend}] para monthlyReport
//   churnMes,            // number (puede pasarse directo en raw para tests)
//   churnTotal,          // number
// }
export function assemble(raw, nowEpochSec) {
  const w = windows(nowEpochSec);

  // ── Ingresos 7 días ────────────────────────────────────────────────────────
  const ghlSucceeded7d = (raw.ghlTx || []).filter(t => t.status === 'succeeded');
  const ghlIng7d   = sumChargesInWindow(ghlSucceeded7d, w.last7, t => epochOf(t.createdAt), t => t.amount);
  const ghlIngPrev  = sumChargesInWindow(ghlSucceeded7d, w.prev7, t => epochOf(t.createdAt), t => t.amount);

  const lwChargesOk = (raw.stripeCharges || []).filter(c => c.paid && c.status === 'succeeded');
  const lwIng7d    = sumChargesInWindow(lwChargesOk, w.last7, c => c.created, c => c.amount / 100);
  const lwIngPrev  = sumChargesInWindow(lwChargesOk, w.prev7, c => c.created, c => c.amount / 100);

  const ing7d  = Math.round(ghlIng7d  + lwIng7d);
  const ingPrev = Math.round(ghlIngPrev + lwIngPrev);

  // ── MTD (mes actual) ───────────────────────────────────────────────────────
  // Primer instante del mes actual en CDMX
  const curMonthKey  = cdmxDayKey(nowEpochSec).slice(0, 7); // "YYYY-MM"
  const mtdStart     = Date.parse(`${curMonthKey}-01T00:00:00-06:00`) / 1000;
  const mtdWin       = { start: mtdStart, end: nowEpochSec };

  const ghlMtd = sumChargesInWindow(ghlSucceeded7d, mtdWin, t => epochOf(t.createdAt), t => t.amount);
  const lwMtd  = sumChargesInWindow(lwChargesOk,     mtdWin, c => c.created,            c => c.amount / 100);
  const mtd    = Math.round(ghlMtd + lwMtd);

  // ── MRR ───────────────────────────────────────────────────────────────────
  const mrrLW  = mrrFromStripeSubs(raw.stripeSubs || []);
  const mrrGHL = mrrFromGhlTransactions(raw.ghlTx || [], nowEpochSec);

  // ── Ventas (funnel GHL succeeded) ─────────────────────────────────────────
  const ventas7d   = ghlSucceeded7d.filter(t => epochOf(t.createdAt) >= w.last7.start && epochOf(t.createdAt) < w.last7.end).length;
  const ventasPrev = ghlSucceeded7d.filter(t => epochOf(t.createdAt) >= w.prev7.start && epochOf(t.createdAt) < w.prev7.end).length;

  // ── Ads spend ─────────────────────────────────────────────────────────────
  const metaDaily = raw.metaDaily || [];
  // dailySpend da [{date:'YYYY-MM-DD', spend}]; usamos el midday CDMX para clasificar en ventana
  const gasto7d   = metaDaily.reduce((s, d) => {
    const e = Date.parse(d.date + 'T12:00:00-06:00') / 1000;
    return s + (e >= w.last7.start && e < w.last7.end ? d.spend : 0);
  }, 0);
  const gastoPrev = metaDaily.reduce((s, d) => {
    const e = Date.parse(d.date + 'T12:00:00-06:00') / 1000;
    return s + (e >= w.prev7.start && e < w.prev7.end ? d.spend : 0);
  }, 0);

  // ── ROAS & CPA ─────────────────────────────────────────────────────────────
  const roas7d   = roas(ghlIng7d,  gasto7d);
  const roasPrev = roas(ghlIngPrev, gastoPrev);
  const cpa7d    = cpa(gasto7d, ventas7d);
  const cpaPrev  = cpa(gastoPrev, ventasPrev);

  // ── Año ───────────────────────────────────────────────────────────────────
  const ingGhlYear = (raw.ghlTxYear || []).filter(t => t.status === 'succeeded').reduce((s, t) => s + t.amount, 0);
  const ingLwYear  = (raw.stripeChargesYear || []).filter(c => c.paid && c.status === 'succeeded').reduce((s, c) => s + c.amount / 100, 0);
  const yr = yearTotals({
    ingresosGhl: Math.round(ingGhlYear),
    ingresosLW:  Math.round(ingLwYear),
    gastoAds:    Math.round(raw.metaSpendYear || 0)
  });

  // ── Reporte mensual ────────────────────────────────────────────────────────
  const adsByMonth = raw.adsByMonth || [];
  const rep = monthlyReport({ ghlTx: raw.ghlTxYear || [], lwCharges: raw.stripeChargesYear || [], adsByMonth });

  const mesNom = {
    '01':'Enero','02':'Febrero','03':'Marzo','04':'Abril',
    '05':'Mayo','06':'Junio','07':'Julio','08':'Agosto',
    '09':'Septiembre','10':'Octubre','11':'Noviembre','12':'Diciembre'
  };
  const cur = cdmxDayKey(nowEpochSec).slice(0, 7); // "YYYY-MM"
  const rowHtml = r => {
    const mon = r.mes.slice(5); // "MM"
    const nomMes = mesNom[mon] || r.mes;
    const ghlCell = r.ghl ? peso(r.ghl) : '—';
    const resMark = r.resultado >= 0 ? `+${peso(r.resultado)}` : peso(r.resultado);
    return `<tr><td>${nomMes}${r.mes === cur ? ' *' : ''}</td><td class="dim">${ghlCell}</td><td class="dim">${peso(r.lw)}</td><td>${peso(r.ingresos)}</td><td class="egr">${peso(r.ads)}</td><td class="pos">${resMark}</td></tr>`;
  };
  const REPORTE_TBODY = rep.rows.map(rowHtml).join('');
  const t = rep.total;
  const tResMark = t.resultado >= 0 ? `+${peso(t.resultado)}` : peso(t.resultado);
  const REPORTE_TFOOT = `<tr><td>Total 2026</td><td class="dim">${peso(t.ghl)}</td><td class="dim">${peso(t.lw)}</td><td>${peso(t.ingresos)}</td><td class="egr">${peso(t.ads)}</td><td class="pos">${tResMark}</td></tr>`;

  // ── Gráfico SVG (SOLO el mes corriente) ────────────────────────────────────
  const curMonth = cdmxDayKey(nowEpochSec).slice(0, 7);
  // incomeByDay: SOLO GHL funnel del mes corriente (LW recurring excluido — no atribuible a gasto en ads)
  const incomeByDay = {};
  for (const tx of (raw.ghlTx || [])) {
    if (tx.status !== 'succeeded') continue;
    const k = cdmxDayKey(epochOf(tx.createdAt));
    if (k.slice(0, 7) !== curMonth) continue;
    incomeByDay[k] = (incomeByDay[k] || 0) + tx.amount;
  }
  const spendByDay = {};
  for (const d of metaDaily) if (d.date.slice(0, 7) === curMonth) spendByDay[d.date] = d.spend;
  const todayKey = cdmxDayKey(nowEpochSec);
  const chartDays = [...new Set([...Object.keys(incomeByDay), ...Object.keys(spendByDay)])].sort();

  // ── Churn ─────────────────────────────────────────────────────────────────
  const churnMes   = raw.churnMes   ?? 0;
  const churnTotal = raw.churnTotal ?? 0;

  // ── Pills ─────────────────────────────────────────────────────────────────
  const ING_PILL = ing7d >= ingPrev
    ? pill('up', `▲ ${deltaTxt(ing7d, ingPrev)} vs semana previa`)
    : pill('down', `▼ ${deltaTxt(ing7d, ingPrev)} vs semana previa`);

  const gastoPct = pct(gasto7d, gastoPrev);
  const GASTO_PILL = gasto7d > gastoPrev
    ? pill('down', `▲ ${deltaTxt(gasto7d, gastoPrev)} gasto vs sem. previa`)
    : pill('up', `▼ ${Math.abs(gastoPct)}% gasto vs sem. previa`);

  const roasPrevFmt = roasPrev.toFixed(2) + 'x';
  const ROAS_PILL = roas7d >= roasPrev
    ? pill('up', `▲ vs ${roasPrevFmt}`)
    : pill('down', `▼ vs ${roasPrevFmt}`);

  const CPAPREV_fmt = peso(cpaPrev);
  const CPA_PILL = cpa7d > cpaPrev
    ? pill('down', `▲ subió desde ${CPAPREV_fmt}`)
    : pill('up', `▼ bajó desde ${CPAPREV_fmt}`);

  // Hero prev strings with deltas
  const ingDelta = ingPrev !== undefined ? deltaTxt(ing7d, ingPrev) : '—';
  const H_ING_PREV = `${peso(ingPrev)} · ${ingDelta}`;

  const leadsPct = pct(raw.leads7d, raw.leadsPrev);
  const leadsDelta = raw.leadsPrev !== undefined ? deltaTxt(raw.leads7d, raw.leadsPrev) : '—';
  const H_LEADS_PREV = `${raw.leadsPrev ?? 0} · ${leadsDelta}`;

  // ── Assemble output ────────────────────────────────────────────────────────
  return {
    // Stamp
    ACTUALIZADO: `Actualizado ${new Date(nowEpochSec * 1000).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`,

    // Año
    ANIO_INGRESOS: peso(yr.ingresos),
    ANIO_DESGLOSE: `GHL ${peso(Math.round(ingGhlYear))} + LearnWorlds ${peso(Math.round(ingLwYear))}`,
    ANIO_GASTO:    peso(yr.gasto),
    ANIO_RESULTADO: (yr.resultado >= 0 ? '+' : '') + peso(yr.resultado),
    ANIO_ROAS:     yr.roasAnual.toFixed(2) + 'x',

    // Hero
    H_ING:        peso(ing7d),
    H_ING_PREV,
    H_VENTAS:     String(ventas7d),
    H_VENTAS_PREV: String(ventasPrev),
    H_LEADS:      String(raw.leads7d ?? 0),
    H_LEADS_PREV,
    H_GASTO:      peso(gasto7d),
    H_GASTO_PREV: peso(gastoPrev),

    // Ingresos
    ING_7D:   peso(ing7d),
    ING_PREV: peso(ingPrev),
    MTD:      peso(mtd),
    ING_PILL,

    // MRR / Churn
    MRR:          peso(mrrLW.mxn + mrrGHL.mxn),
    MRR_DESGLOSE: `${mrrLW.count + mrrGHL.count} subs · LW ${peso(mrrLW.mxn)} + GHL ${peso(mrrGHL.mxn)} (Stripe + PayPal)`,
    CHURN:        String(churnMes),
    CHURN_HIST:   String(churnTotal),

    // Ads
    GASTO_7D:   peso(gasto7d),
    GASTO_PREV: peso(gastoPrev),
    GASTO_PILL,
    ROAS_7D:   roas7d.toFixed(2) + 'x',
    ROAS_PREV: roasPrev.toFixed(2) + 'x',
    ROAS_PILL,
    CPA_7D:   peso(cpa7d),
    CPA_PREV: peso(cpaPrev),
    CPA_PILL,

    // Gráfico + reporte
    GRAFICO_MES:  ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][parseInt(curMonth.slice(5, 7), 10) - 1],
    GRAFICO_SVG:  buildSvg(incomeByDay, spendByDay, chartDays, todayKey),
    REPORTE_TBODY,
    REPORTE_TFOOT,
  };
}

// ── main ──────────────────────────────────────────────────────────────────────
export async function main() {
  const { GHL_TOKEN, META_TOKEN, STRIPE_LW_KEY } = process.env;
  const LOC  = 'LPzSGnQ8nE4JW2tCmg6d';
  const PIPE = 'JsfUDdPGX5oeuTvbYxpc';
  const ACC  = '717842110181692';
  const now  = Math.floor(Date.now() / 1000);

  // Año 2026 inicia el 1 ene CDMX
  const yStart = Math.floor(Date.parse('2026-01-01T00:00:00-06:00') / 1000);

  const today     = cdmxDayKey(now);
  const todayDash = today; // YYYY-MM-DD
  const last7Day  = cdmxDayKey(now - 6 * 86400);
  const prev7Day  = cdmxDayKey(now - 13 * 86400);
  const prev0Day  = cdmxDayKey(now - 7 * 86400);
  const monthStart = today.slice(0, 7) + '-01';
  const metaSince  = monthStart < prev7Day ? monthStart : prev7Day; // cubre el mes corriente y las 2 ventanas 7d

  const mmddyyyy = epochSec => {
    const [y, m, d] = cdmxDayKey(epochSec).split('-');
    return `${m}-${d}-${y}`;
  };

  const [
    stripeSubs,
    canceledSubs,
    stripeChargesYear,
    ghlTxYear,
    leads7d,
    leadsPrev,
    metaDaily,
    adsByMonth,
  ] = await Promise.all([
    listActiveSubs(STRIPE_LW_KEY),
    listCanceledSubs(STRIPE_LW_KEY),
    listChargesSince(STRIPE_LW_KEY, yStart),
    listTransactions(GHL_TOKEN, LOC, '2026-01-01', '2026-12-31'),
    leadsCount(GHL_TOKEN, LOC, PIPE, mmddyyyy(now - 6 * 86400), mmddyyyy(now)),
    leadsCount(GHL_TOKEN, LOC, PIPE, mmddyyyy(now - 13 * 86400), mmddyyyy(now - 7 * 86400)),
    // Desde el inicio del mes corriente (dailySpend pagina, no se trunca); cubre gráfico + ventanas 7d.
    dailySpend(META_TOKEN, ACC, metaSince, todayDash),
    monthlySpend(META_TOKEN, ACC, '2026-01-01', todayDash),
  ]);

  // Gasto anual: suma de los meses (monthlySpend trae 1 fila por mes, no se trunca por paginación).
  const metaSpendYear = adsByMonth.reduce((s, m) => s + m.spend, 0);

  // Churn: subs canceladas este mes calendario
  const curMonthKey = cdmxDayKey(now).slice(0, 7);
  const mtdStart    = Date.parse(`${curMonthKey}-01T00:00:00-06:00`) / 1000;
  const churnMes    = canceledSubs.filter(s => s.canceled_at && s.canceled_at >= mtdStart).length;
  const churnTotal  = canceledSubs.length;

  const raw = {
    stripeSubs,
    stripeCharges:     stripeChargesYear,
    stripeChargesYear,
    ghlTx:             ghlTxYear,
    ghlTxYear,
    leads7d,
    leadsPrev,
    metaDaily,
    metaSpendYear,
    adsByMonth,
    churnMes,
    churnTotal,
  };

  const data = assemble(raw, now);
  const tpl  = fs.readFileSync(new URL('../templates/pulso.template.html', import.meta.url), 'utf8');
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/index.html', render(tpl, data));
  console.log('Pulso generado: dist/index.html');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(e); process.exit(1); });
}
