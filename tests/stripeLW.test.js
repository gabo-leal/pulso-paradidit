import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listActiveSubs } from '../src/sources/stripeLW.js';

test('listActiveSubs sigue la paginación has_more', async () => {
  let calls = 0;
  const mock = async (url) => {
    calls++;
    if (calls === 1) return { ok: true, json: async () => ({ data: [{ id: 'sub_1' }], has_more: true }) };
    return { ok: true, json: async () => ({ data: [{ id: 'sub_2' }], has_more: false }) };
  };
  const subs = await listActiveSubs('rk_test_x', mock);
  assert.equal(subs.length, 2);
  assert.equal(calls, 2);
});
