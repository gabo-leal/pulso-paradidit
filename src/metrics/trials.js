// Métricas de la campaña de trials: primer mes a $10 MXN, autorenueva a $349.
// Fuente: transacciones GHL del año (todas, incluidas las fallidas).
export const TRIAL_PRICE = 10;
export const FULL_PRICE = 349;
export const TRIAL_WINDOW_DAYS = 32; // mes de Stripe + margen

const DAY = 86400;

// GHL entrega el mensaje legible de Stripe en last_payment_error.decline_code
function motivoLabel(declineCode) {
  const s = declineCode || '';
  if (/insufficient funds/i.test(s)) return 'Fondos insuficientes';
  if (/expired/i.test(s)) return 'Tarjeta expirada';
  if (/declined/i.test(s)) return 'Tarjeta rechazada';
  return 'Otro';
}

export function trialsSummary(ghlTx, nowEpochSec) {
  const porSub = new Map();
  for (const t of ghlTx || []) {
    if (!t.subscriptionId) continue;
    if (!porSub.has(t.subscriptionId)) porSub.set(t.subscriptionId, []);
    porSub.get(t.subscriptionId).push(t);
  }

  let renovaron = 0, errorPago = 0, abiertos = 0, cancelaron = 0;
  const motivos = new Map();

  for (const txs of porSub.values()) {
    txs.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    // Cohorte: el primer cobro exitoso de la sub debe ser el trial de $10
    const primerOk = txs.find(t => t.status === 'succeeded');
    if (!primerOk || primerOk.amount !== TRIAL_PRICE) continue;

    const plenos = txs.filter(t => t.amount === FULL_PRICE);
    if (plenos.some(t => t.status === 'succeeded')) { renovaron++; continue; }

    const fallidos = plenos.filter(t => t.status === 'failed');
    if (fallidos.length) {
      errorPago++;
      const ultimo = fallidos[fallidos.length - 1];
      const motivo = motivoLabel(ultimo.chargeSnapshot?.last_payment_error?.decline_code);
      motivos.set(motivo, (motivos.get(motivo) || 0) + 1);
      continue;
    }

    const trialEpoch = Date.parse(primerOk.createdAt) / 1000;
    if (nowEpochSec - trialEpoch <= TRIAL_WINDOW_DAYS * DAY) abiertos++;
    else cancelaron++;
  }

  const madura = renovaron + errorPago + cancelaron;
  return {
    cohorte: madura + abiertos,
    renovaron,
    errorPago,
    abiertos,
    cancelaron,
    conversion: madura ? renovaron / madura : 0,
    mrrGanado: FULL_PRICE * renovaron,
    enRiesgo: FULL_PRICE * errorPago,
    motivosError: [...motivos]
      .map(([motivo, count]) => ({ motivo, count }))
      .sort((a, b) => b.count - a.count),
  };
}
