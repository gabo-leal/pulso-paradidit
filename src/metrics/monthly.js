export function monthlyReport({ ghlTx, lwCharges, adsByMonth }) {
  const inc = {};
  const bump = (m, k, v) => { (inc[m] ??= { ghl: 0, lw: 0 })[k] += v; };
  // Groups by UTC month (per plan interface). A CDMX-evening transaction (e.g. 23:00 CDMX = next UTC day)
  // can land in the adjacent UTC month — intentional; do NOT "fix" to CDMX without updating all callers.
  for (const t of ghlTx) if (t.status === 'succeeded') bump(t.createdAt.slice(0, 7), 'ghl', t.amount);
  for (const c of lwCharges) if (c.paid && c.status === 'succeeded') {
    const m = new Date(c.created * 1000).toISOString().slice(0, 7);
    bump(m, 'lw', c.amount / 100);
  }
  const ads = {};
  for (const a of adsByMonth) ads[a.month] = a.spend;
  const months = [...new Set([...Object.keys(inc), ...Object.keys(ads)])].sort();
  let tg = 0, tl = 0, ta = 0;
  const rows = months.map(m => {
    const ghl = Math.round(inc[m]?.ghl || 0);
    const lw = Math.round(inc[m]?.lw || 0);
    const a = Math.round(ads[m] || 0);
    tg += ghl; tl += lw; ta += a;
    return { mes: m, ghl, lw, ingresos: ghl + lw, ads: a, resultado: ghl + lw - a };
  });
  return { rows, total: { ghl: tg, lw: tl, ingresos: tg + tl, ads: ta, resultado: tg + tl - ta } };
}
