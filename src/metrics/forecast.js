// Proyección de MRR del funnel de trials.
// AUTOCONTENIDA a propósito: assemble() la embebe con .toString() en el template
// y corre idéntica en Node (tests) y en el navegador (pestaña Forecast).
// No agregar imports, closures sobre el módulo, ni "{{" en el fuente.
export function proyectarMrr(p) {
  var num = function (v) { return (typeof v === 'number' && isFinite(v) && v > 0) ? v : 0; };
  // Base en MRR real: LW y GHL pagan precios distintos, así que se churnea el
  // MRR directamente; solo los trials nuevos entran a precio pleno ($349).
  var mrr = num(p.mrrInicial);
  var subs = num(p.subsIniciales); // referencia visual, no participa en el MRR
  var nuevos = num(p.trialsMes) * (Math.min(num(p.conversionPct), 100) / 100);
  var churn = Math.min(num(p.churnPct), 100) / 100;
  var precio = num(p.precio);
  var meses = num(p.meses) >= 1 ? Math.floor(num(p.meses)) : 12;

  var rows = [];
  var acumulado = 0;
  for (var m = 1; m <= meses; m++) {
    var mrrPrev = mrr;
    mrr = mrr * (1 - churn) + nuevos * precio;
    subs = subs * (1 - churn) + nuevos;
    acumulado += mrr;
    rows.push({ mes: m, nuevos: nuevos, subs: subs, mrr: mrr, delta: mrr - mrrPrev, acumulado: acumulado });
  }
  return rows;
}
