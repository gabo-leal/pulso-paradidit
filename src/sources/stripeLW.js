const BASE = 'https://api.stripe.com/v1';

function auth(key) {
  return { Authorization: 'Bearer ' + key };
}

async function paginate(url, key, fetchImpl) {
  const out = [];
  let after = null;
  do {
    const u = new URL(url);
    u.searchParams.set('limit', '100');
    if (after) u.searchParams.set('starting_after', after);
    const res = await fetchImpl(u.toString(), { headers: auth(key) });
    if (!res.ok) throw new Error('Stripe ' + res.status);
    const body = await res.json();
    out.push(...body.data);
    after = body.has_more ? body.data[body.data.length - 1].id : null;
  } while (after);
  return out;
}

export function listActiveSubs(key, fetchImpl = globalThis.fetch) {
  return paginate(`${BASE}/subscriptions?status=active`, key, fetchImpl);
}

export function listChargesSince(key, sinceEpoch, fetchImpl = globalThis.fetch) {
  return paginate(`${BASE}/charges?created[gte]=${sinceEpoch}`, key, fetchImpl);
}

export function listCanceledSubs(key, fetchImpl = globalThis.fetch) {
  return paginate(`${BASE}/subscriptions?status=canceled`, key, fetchImpl);
}
