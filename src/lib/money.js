export function centsToMXN(cents) {
  return Math.round((cents || 0) / 100);
}

export function monthlyFromStripeItem({ unit_amount = 0, quantity = 1, interval, interval_count = 1 }) {
  const amt = unit_amount * quantity;
  const ic = interval_count || 1;
  switch (interval) {
    case 'month': return amt / ic;
    case 'year':  return amt / (12 * ic);
    case 'week':  return amt * 52 / 12;
    case 'day':   return amt * 365 / 12;
    default:      return amt;
  }
}
