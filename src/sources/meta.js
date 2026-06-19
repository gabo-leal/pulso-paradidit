const BASE = 'https://graph.facebook.com/v21.0';

export function parseMetaAmount(s) {
  if (typeof s !== 'string') return Number(s) || 0;
  return Number(s.replace(/[^0-9.]/g, '')) || 0;
}

export async function dailySpend(token, accountId, since, until, fetchImpl = globalThis.fetch) {
  const u = new URL(`${BASE}/act_${accountId}/insights`);
  u.searchParams.set('fields', 'spend');
  u.searchParams.set('time_increment', '1');
  u.searchParams.set('time_range', JSON.stringify({ since, until }));
  u.searchParams.set('access_token', token);
  // Meta pagina los insights diarios (~25 por página); seguimos paging.next para no truncar el mes.
  const out = [];
  let url = u.toString();
  while (url) {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error('Meta ' + res.status);
    const body = await res.json();
    out.push(...(body.data ?? []));
    url = body.paging?.next ?? null;
  }
  return out.map(d => ({ date: d.date_start, spend: Number(d.spend) || 0 }));
}

export async function monthlySpend(token, accountId, since, until, fetchImpl = globalThis.fetch) {
  const u = new URL(`${BASE}/act_${accountId}/insights`);
  u.searchParams.set('fields', 'spend');
  u.searchParams.set('time_increment', 'monthly');
  u.searchParams.set('time_range', JSON.stringify({ since, until }));
  u.searchParams.set('access_token', token);
  const res = await fetchImpl(u.toString());
  if (!res.ok) throw new Error('Meta ' + res.status);
  const body = await res.json();
  return (body.data ?? []).map(d => ({ month: d.date_start.slice(0, 7), spend: Number(d.spend) || 0 }));
}
