// Proyección de MRR del funnel de trials.
// AUTOCONTENIDA a propósito: assemble() la embebe con .toString() en el template
// y corre idéntica en Node (tests) y en el navegador (pestaña Forecast).
// No agregar imports, closures sobre el módulo, ni "{{" en el fuente.
export function proyectarMrr(p) {
  var num = function (v) { return (typeof v === 'number' && isFinite(v) && v > 0) ? v : 0; };
  var subs = num(p.subsIniciales);
  var nuevos = num(p.trialsMes) * (Math.min(num(p.conversionPct), 100) / 100);
  var churn = Math.min(num(p.churnPct), 100) / 100;
  var precio = num(p.precio);
  var meses = num(p.meses) >= 1 ? Math.floor(num(p.meses)) : 6;

  var rows = [];
  var mrrPrev = subs * precio;
  var acumulado = 0;
  for (var m = 1; m <= meses; m++) {
    subs = subs * (1 - churn) + nuevos;
    var mrr = subs * precio;
    acumulado += mrr;
    rows.push({ mes: m, nuevos: nuevos, subs: subs, mrr: mrr, delta: mrr - mrrPrev, acumulado: acumulado });
    mrrPrev = mrr;
  }
  return rows;
}
