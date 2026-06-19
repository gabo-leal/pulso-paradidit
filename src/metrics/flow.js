export function sumChargesInWindow(items, win, getEpoch, getAmount) {
  let s = 0;
  for (const it of items) {
    const e = getEpoch(it);
    if (e >= win.start && e < win.end) s += getAmount(it);
  }
  return s;
}

export function roas(ingresosFunnel, gasto) {
  if (!gasto) return 0;
  return Math.ceil((ingresosFunnel / gasto) * 100) / 100;
}

export function cpa(gasto, ventas) {
  if (!ventas) return 0;
  return Math.round(gasto / ventas);
}
