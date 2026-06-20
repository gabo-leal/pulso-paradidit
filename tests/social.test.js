import { test } from 'node:test';
import assert from 'node:assert/strict';
import { socialSummary } from '../src/metrics/social.js';

test('socialSummary normaliza por plataforma', () => {
  const results = {
    breakdowns: {
      impressions: { platforms: { instagram: { value: 60723, change: '205.92' } } },
      reach: { platforms: { instagram: { value: 39900, change: '273.98' } } },
      engagement: { instagram: { likes: 645, comments: 6, shares: 22, change: '154.92' } },
    },
    platformTotals: { followers: { instagram: { total: 174 } } },
  };
  const r = socialSummary(results, ['instagram']);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], {
    platform: 'instagram', impressions: 60723, impressionsChange: 205.92,
    reach: 39900, reachChange: 273.98, engagement: 673, engagementChange: 154.92, followersGrowth: 174,
  });
});

test('socialSummary tolera plataforma sin datos', () => {
  const r = socialSummary({}, ['facebook']);
  assert.deepEqual(r[0], { platform: 'facebook', impressions: 0, impressionsChange: 0, reach: 0, reachChange: 0, engagement: 0, engagementChange: 0, followersGrowth: 0 });
});
