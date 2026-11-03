const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCapture } = require('../apps-script/Parse.js');
const { DEFAULT_CONTEXT } = require('../apps-script/Schema.js');
const cases = require('./fixtures/phrases.json');

const baseContext = DEFAULT_CONTEXT.map(([kind, key, value, active]) => ({ kind, key, value, active }));

function pick(actual, expected, path = '') {
  for (const [k, v] of Object.entries(expected)) {
    if (v && typeof v === 'object') pick(actual[k] || {}, v, path + k + '.');
    else assert.equal(actual[k], v, `${path}${k}`);
  }
}

for (const c of cases) {
  test(`parses: "${c.text}" @ ${c.now}`, () => {
    const ctx = baseContext.concat(c.extraContext || []);
    const r = parseCapture(c.text, ctx, c.now, c.openItems || []);
    pick(r, c.expect);
  });
}

test('inactive keywords are ignored', () => {
  const ctx = baseContext.map(r => (r.key === 'gilman' && r.kind === 'keyword') ? { ...r, active: false } : r);
  const r = parseCapture('gilman essay', ctx, '2026-11-02T20:15:00-07:00', []);
  assert.equal(r.group, null);
});

test('a weekday abbreviation inside a keyword phrase is not read as a date', () => {
  const r = parseCapture('mountain sun shift', baseContext, '2026-11-02T20:15:00-07:00', []);
  assert.equal(r.date, null);
});

test('result always has every field', () => {
  const r = parseCapture('x', baseContext, '2026-11-02T20:15:00-07:00', []);
  for (const k of ['title', 'area', 'group', 'date', 'time', 'type', 'parentId', 'confidence', 'alternatives']) assert.ok(k in r, k);
});
