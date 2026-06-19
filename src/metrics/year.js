export function yearTotals({ ingresosGhl, ingresosLW, gastoAds }) {
  const ingresos = ingresosGhl + ingresosLW;
  const resultado = ingresos - gastoAds;
  const roasAnual = gastoAds ? Math.round((ingresos / gastoAds) * 100) / 100 : 0;
  return { ingresos, gasto: gastoAds, resultado, roasAnual };
}
