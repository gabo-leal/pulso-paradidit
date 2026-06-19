// pulso/tests/render.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../src/render.js';

test('render sustituye marcadores', () => {
  const out = render('<b>{{ING_7D}}</b> vs {{ING_PREV}}', { ING_7D: '$6,892', ING_PREV: '$3,174' });
  assert.equal(out, '<b>$6,892</b> vs $3,174');
});

test('render lanza si queda un marcador sin valor', () => {
  assert.throws(() => render('{{FALTANTE}}', {}), /marcador sin sustituir/i);
});
