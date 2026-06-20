const num = v => Number(v) || 0;

export function socialSummary(results, platforms) {
  const bd = results?.breakdowns ?? {};
  const ft = results?.platformTotals?.followers ?? {};
  return platforms.map(p => {
    const imp = bd.impressions?.platforms?.[p] ?? {};
    const rch = bd.reach?.platforms?.[p] ?? {};
    const eng = bd.engagement?.[p] ?? {};
    return {
      platform: p,
      impressions: num(imp.value),
      impressionsChange: num(imp.change),
      reach: num(rch.value),
      reachChange: num(rch.change),
      engagement: num(eng.likes) + num(eng.comments) + num(eng.shares),
      engagementChange: num(eng.change),
      followersGrowth: num(ft[p]?.total),
    };
  });
}
