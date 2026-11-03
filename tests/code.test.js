const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCapture, buildInboxRow, keyFor } = require('../apps-script/Code.js');
const { DEFAULT_CONTEXT } = require('../apps-script/Schema.js');

const ctx = DEFAULT_CONTEXT.map(([kind, key, value, active]) => ({ kind, key, value, active }));
const NOW = '2026-11-02T20:15:00-07:00';

test('validateCapture: empty or whitespace text is rejected', () => {
  assert.deepEqual(validateCapture({ action: 'capture', text: '   ', source: 'page', now: NOW }), { ok: false, error: 'Capture is empty' });
});

test('validateCapture: a 20,000-character capture is accepted', () => {
  assert.equal(validateCapture({ action: 'capture', text: 'x'.repeat(20000), source: 'siri', now: NOW }).ok, true);
});

test('validateCapture: source must be page, siri or claude', () => {
  assert.equal(validateCapture({ action: 'capture', text: 'hi', source: 'email', now: NOW }).ok, false);
});

test('validateCapture: now must be ISO with an offset', () => {
  assert.equal(validateCapture({ action: 'capture', text: 'hi', source: 'page', now: '2026-11-02 20:15' }).ok, false);
  assert.equal(validateCapture({ action: 'capture', text: 'hi', source: 'page', now: '2026-11-02T20:15:00Z' }).ok, true);
  assert.equal(validateCapture({ action: 'capture', text: 'hi', source: 'page', now: '2026-11-02T20:15:00.123-07:00' }).ok, true);
});

test('validateCapture: upsert needs a known tab and a rows array', () => {
  assert.equal(validateCapture({ action: 'upsert', tab: 'Nope', rows: [] }).ok, false);
  assert.equal(validateCapture({ action: 'upsert', tab: 'Steps', rows: 'x' }).ok, false);
  assert.equal(validateCapture({ action: 'upsert', tab: 'Steps', rows: [] }).ok, true);
});

test('validateCapture: unknown action is rejected', () => {
  assert.equal(validateCapture({ action: 'drop' }).ok, false);
  assert.equal(validateCapture(null).ok, false);
});

test('buildInboxRow fills the guess columns from the parser', () => {
  const row = buildInboxRow({ text: 'neuro reading due thursday', source: 'page', now: NOW }, ctx, [], 'in_1');
  assert.equal(row.id, 'in_1');
  assert.equal(row.status, 'new');
  assert.equal(row.capturedAt, NOW);
  assert.equal(row.guessArea, 'school');
  assert.equal(row.guessGroup, 'neuro');
  assert.equal(row.guessDate, '2026-11-05');
  assert.equal(row.guessType, 'deadline');
  assert.equal(row.guessTitle, 'Neuro reading');
  assert.deepEqual(JSON.parse(row.confidence), { where: 'sure', when: 'sure', type: 'sure' });
  assert.deepEqual(JSON.parse(row.alternatives), {});
});

test('buildInboxRow stores a long paste whole and skips parsing', () => {
  const text = 'syllabus '.repeat(300);
  const row = buildInboxRow({ text, source: 'claude', now: NOW }, ctx, [], 'in_2');
  assert.equal(row.text, text);
  assert.equal(row.guessTitle, '');
  assert.deepEqual(JSON.parse(row.confidence), { where: 'none', when: 'none', type: 'none' });
});

test('keyFor picks the right merge key per tab', () => {
  assert.equal(keyFor('Steps')({ id: 's1' }), 's1');
  assert.equal(keyFor('Context')({ kind: 'keyword', key: 'neuro' }), 'keyword|neuro');
  assert.equal(keyFor('Quotes')({ text: 'Slow is smooth.' }), 'Slow is smooth.');
  assert.equal(keyFor('Log')({ inboxId: 'in_1', field: 'group', at: 't' }), 'in_1|group|t');
});

test('upsert writes to the right sheet row even with a blank row in the middle', () => {
  const { HEADERS } = require('../apps-script/Schema.js');
  const { upsert_ } = require('../apps-script/Code.js');
  const rows = [HEADERS.Steps, ['s1', 'i1', 'A', false, 1, '2026-11-02T10:00:00-07:00'], ['', '', '', '', '', ''], ['s2', 'i1', 'B', false, 2, '2026-11-02T10:00:00-07:00']];
  const sheet = {
    getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }),
    getRange: (r, c, nr, nc) => ({ setValues: (v) => { rows[r - 1] = v[0]; } }),
    appendRow: (v) => rows.push(v)
  };
  global.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) };
  const changed = upsert_('Steps', [{ id: 's2', itemId: 'i1', text: 'B', done: true, order: 2, updated: '2026-11-02T11:00:00-07:00' }]);
  assert.deepEqual(changed, ['s2']);
  assert.equal(rows[3][3], true);
  assert.deepEqual(rows[2], ['', '', '', '', '', '']);
  assert.equal(rows[1][3], false);
  delete global.SpreadsheetApp;
});
