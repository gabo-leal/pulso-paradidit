export function campaignBreakdown(campaigns) {
  const conGasto = campaigns.filter(c => c.spend > 0);
  if (campaigns.length === 0) return { rows: [], mejor: null, peor: null };
  const avgCtr = conGasto.length ? conGasto.reduce((s, c) => s + c.ctr, 0) / conGasto.length : 0;
  const rows = [...campaigns]
    .sort((a, b) => b.spend - a.spend)
    .map(c => ({
      nombre: c.name,
      gasto: Math.round(c.spend),
      roas: c.roas,
      cpa: c.purchases ? Math.round(c.spend / c.purchases) : 0,
      ctr: c.ctr,
      fatiga: c.spend > 0 && c.ctr < avgCtr * 0.7,
    }));
  let mejor = null, peor = null;
  if (conGasto.length) {
    mejor = conGasto.reduce((m, c) => (c.roas > m.roas ? c : m)).name;
    peor  = conGasto.reduce((m, c) => (c.roas < m.roas ? c : m)).name;
  }
  return { rows, mejor, peor };
}
