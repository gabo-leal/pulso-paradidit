import { monthlyFromStripeItem, centsToMXN } from '../lib/money.js';

export function mrrFromStripeSubs(subs) {
  let cents = 0;
  for (const s of subs) {
    for (const it of (s.items?.data ?? [])) {
      cents += monthlyFromStripeItem({
        unit_amount: it.price?.unit_amount ?? 0,
        quantity: it.quantity ?? 1,
        interval: it.price?.recurring?.interval,
        interval_count: it.price?.recurring?.interval_count ?? 1
      });
    }
  }
  return { mxn: centsToMXN(cents), count: subs.length };
}

const DAY = 86400;
export function mrrFromGhlTransactions(transactions, nowEpochSec) {
  const cutoff = nowEpochSec - 35 * DAY;
  const bySub = new Map();
  for (const t of transactions) {
    if (t.status !== 'succeeded' || !t.subscriptionId) continue;
    const epoch = Date.parse(t.createdAt) / 1000;
    const cur = bySub.get(t.subscriptionId);
    if (!cur || epoch > cur.epoch) bySub.set(t.subscriptionId, { epoch, amount: t.amount });
  }
  let mxn = 0, count = 0;
  for (const { epoch, amount } of bySub.values()) {
    if (epoch >= cutoff) { mxn += amount; count++; }
  }
  return { mxn: Math.round(mxn), count };
}

// Pase Anual PRO: pago único (sin subscriptionId) con vigencia de 12 meses.
// Aporta amount/12 al MRR mientras no venza (365 días desde el cobro).
const PASE_ANUAL = 'Pase Anual PRO';
export function pasesAnuales(transactions, nowEpochSec) {
  const cutoff = nowEpochSec - 365 * DAY;
  let mxn = 0, count = 0;
  for (const t of transactions) {
    if (t.status !== 'succeeded' || t.entitySourceName !== PASE_ANUAL) continue;
    if (Date.parse(t.createdAt) / 1000 < cutoff) continue;
    mxn += t.amount / 12;
    count++;
  }
  return { mxn, count };
}
