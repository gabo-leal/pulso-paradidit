const BASE = 'https://graph.facebook.com/v21.0';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Meta responde 403 en rate limits transitorios (visto en CI el 30-jul-2026), no solo en permisos.
export async function metaFetch(url, fetchImpl = globalThis.fetch, sleepImpl = sleep) {
  const ATTEMPTS = 3;
  for (let i = 1; ; i++) {
    const res = await fetchImpl(url);
    if (res.ok) return res;
    const transient = res.status === 403 || res.status >= 500;
    if (!transient || i >= ATTEMPTS) throw new Error('Meta ' + res.status);
    await sleepImpl(500 * 2 ** (i - 1));
  }
}

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
    const res = await metaFetch(url, fetchImpl);
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
  const res = await metaFetch(u.toString(), fetchImpl);
  const body = await res.json();
  return (body.data ?? []).map(d => ({ month: d.date_start.slice(0, 7), spend: Number(d.spend) || 0 }));
}

export async function campaignInsights(token, accountId, datePreset = 'last_7d', fetchImpl = globalThis.fetch) {
  const u = new URL(`${BASE}/act_${accountId}/insights`);
  u.searchParams.set('level', 'campaign');
  u.searchParams.set('fields', 'campaign_name,spend,purchase_roas,actions,ctr,cpc');
  u.searchParams.set('date_preset', datePreset);
  u.searchParams.set('access_token', token);
  const out = [];
  let url = u.toString();
  while (url) {
    const res = await metaFetch(url, fetchImpl);
    const body = await res.json();
    for (const d of (body.data ?? [])) {
      const roasItem = (d.purchase_roas ?? []).find(x => x.action_type === 'omni_purchase');
      const purchItem = (d.actions ?? []).find(x => x.action_type === 'omni_purchase');
      out.push({
        name: d.campaign_name,
        spend: Number(d.spend) || 0,
        roas: Number(roasItem?.value) || 0,
        purchases: Number(purchItem?.value) || 0,
        ctr: Number(d.ctr) || 0,
        cpc: Number(d.cpc) || 0,
      });
    }
    url = body.paging?.next ?? null;
  }
  return out;
}
