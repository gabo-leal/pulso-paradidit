const BASE = 'https://services.leadconnectorhq.com';

function headers(token) {
  return { Authorization: 'Bearer ' + token, Version: '2021-07-28', Accept: 'application/json' };
}

export async function listTransactions(token, locationId, startAt, endAt, fetchImpl = globalThis.fetch) {
  const out = [];
  let offset = 0, total = Infinity;
  while (offset < total) {
    const u = new URL(`${BASE}/payments/transactions`);
    u.searchParams.set('altId', locationId);
    u.searchParams.set('altType', 'location');
    u.searchParams.set('paymentMode', 'live');
    u.searchParams.set('startAt', startAt);
    u.searchParams.set('endAt', endAt);
    u.searchParams.set('limit', '100');
    u.searchParams.set('offset', String(offset));
    const res = await fetchImpl(u.toString(), { headers: headers(token) });
    if (!res.ok) throw new Error('GHL tx ' + res.status);
    const body = await res.json();
    const data = body.data ?? [];
    out.push(...data);
    total = body.totalCount ?? out.length;
    if (data.length === 0) break;
    offset += 100;
  }
  return out;
}

export async function leadsCount(token, locationId, pipelineId, date, endDate, fetchImpl = globalThis.fetch) {
  const u = new URL(`${BASE}/opportunities/search`);
  u.searchParams.set('location_id', locationId);
  u.searchParams.set('pipeline_id', pipelineId);
  u.searchParams.set('status', 'all');
  u.searchParams.set('date', date);
  u.searchParams.set('endDate', endDate);
  u.searchParams.set('limit', '1');
  const res = await fetchImpl(u.toString(), { headers: headers(token) });
  if (!res.ok) throw new Error('GHL leads ' + res.status);
  const body = await res.json();
  return body.data?.meta?.total ?? 0;
}
