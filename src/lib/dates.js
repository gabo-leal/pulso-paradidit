const TZ = 'America/Mexico_City';
const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
});

export function cdmxDayKey(epochSeconds) {
  return fmt.format(new Date(epochSeconds * 1000)); // en-CA => YYYY-MM-DD
}

// Medianoche CDMX (epoch seg) del día que contiene `epochSeconds`.
function cdmxMidnight(epochSeconds) {
  const key = cdmxDayKey(epochSeconds);          // "YYYY-MM-DD"
  // CDMX es UTC-6 todo el año (sin DST desde 2023).
  return Date.parse(`${key}T00:00:00-06:00`) / 1000;
}

export function windows(nowEpochSec) {
  const today0 = cdmxMidnight(nowEpochSec);
  const last7Start = today0 - 6 * 86400;
  const prev7Start = last7Start - 7 * 86400;
  return {
    last7: { start: last7Start, end: nowEpochSec },
    prev7: { start: prev7Start, end: last7Start }
  };
}
