const BASE = 'https://services.leadconnectorhq.com';

function headers(token) {
  return { Authorization: 'Bearer ' + token, Version: '2021-07-28', Accept: 'application/json', 'Content-Type': 'application/json' };
}

export async function listSocialAccounts(token, locationId, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(`${BASE}/social-media-posting/${locationId}/accounts`, { headers: headers(token) });
  if (!res.ok) throw new Error('GHL social accounts ' + res.status);
  const body = await res.json();
  // La API REST devuelve results en la raíz; el MCP lo envolvía en body.data.results.
  const accounts = body.results?.accounts ?? body.data?.results?.accounts ?? [];
  return accounts.map(a => ({ profileId: a.profileId, platform: a.platform, name: a.name }));
}

export async function socialStats(token, locationId, profileIds, platforms, fetchImpl = globalThis.fetch) {
  // /statistics requiere locationId como query param (no en el path).
  const url = `${BASE}/social-media-posting/statistics?locationId=${locationId}`;
  const res = await fetchImpl(url, {
    method: 'POST', headers: headers(token), body: JSON.stringify({ profileIds, platforms }),
  });
  if (!res.ok) throw new Error('GHL social stats ' + res.status);
  const body = await res.json();
  return body.results ?? body.data?.results ?? {};
}
