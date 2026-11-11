const test = require('node:test');
const assert = require('node:assert/strict');
const { toObjects, toRow, mergeRows } = require('../apps-script/Store.js');
const { HEADERS } = require('../apps-script/Schema.js');

test('round-trips every tab', () => {
  for (const tab of Object.keys(HEADERS)) {
    const obj = Object.fromEntries(HEADERS[tab].map((c, i) => [c, c === 'done' || c === 'active' || c === 'deleted' || c === 'starred' ? true : `${tab}-${c}-${i}`]));
    const back = toObjects(tab, [HEADERS[tab], toRow(tab, obj)])[0];
    assert.deepEqual(back, obj, tab);
  }
});

test('toRow fills missing fields with empty strings and drops unknown ones', () => {
  assert.deepEqual(toRow('Steps', { id: 's1', text: 'Build slides', bogus: 'x' }), ['s1', '', 'Build slides', '', '', '', '']);
});

test('toObjects skips the header row and blank rows, turns TRUE/FALSE into booleans for done and active', () => {
  const rows = [HEADERS.Steps, ['s1', 'i1', 'Read ch 1', 'TRUE', 1, 'u'], ['', '', '', '', '', ''], ['s2', 'i1', 'Outline', false, 2, 'u']];
  const out = toObjects('Steps', rows);
  assert.equal(out.length, 2);
  assert.equal(out[0].done, true);
  assert.equal(out[1].done, false);
});

test('toObjects turns a Date cell back into text', () => {
  const out = toObjects('Items', [HEADERS.Items, ['i1', 'school', 'neuro', 'T', new Date(2026, 10, 5), '', 'deadline', '', 'open', '', '', '']]);
  assert.equal(out[0].date, '2026-11-05');
});

const row = (id, updated, title) => ({ id, updated, title });

test('newer updated wins', () => {
  const r = mergeRows([row('a', '2026-11-02T10:00:00-07:00', 'old')], [row('a', '2026-11-02T11:00:00-07:00', 'new')]);
  assert.equal(r.rows[0].title, 'new');
  assert.deepEqual(r.changed, ['a']);
});

test('older incoming is ignored', () => {
  const r = mergeRows([row('a', '2026-11-02T11:00:00-07:00', 'keep')], [row('a', '2026-11-02T10:00:00-07:00', 'stale')]);
  assert.equal(r.rows[0].title, 'keep');
  assert.deepEqual(r.changed, []);
});

test('tie keeps existing', () => {
  const r = mergeRows([row('a', '2026-11-02T11:00:00-07:00', 'first')], [row('a', '2026-11-02T11:00:00-07:00', 'second')]);
  assert.equal(r.rows[0].title, 'first');
  assert.deepEqual(r.changed, []);
});

test('timestamps in different offsets compare by real instant', () => {
  // existing = 03:00Z; incoming (Prague) = 02:30Z, so incoming is older
  const r = mergeRows([row('a', '2026-11-02T20:00:00-07:00', 'denver')], [row('a', '2026-11-03T03:30:00+01:00', 'prague')]);
  assert.equal(r.rows[0].title, 'denver');
});

test('unknown id is appended', () => {
  const r = mergeRows([row('a', 'x', 'A')], [row('b', '2026-11-02T10:00:00-07:00', 'B')]);
  assert.deepEqual(r.rows.map(x => x.id), ['a', 'b']);
  assert.deepEqual(r.changed, ['b']);
});

test('special characters round-trip', () => {
  const title = 'Order 48t chainring, "gold" ✨\nline two';
  const back = toObjects('Items', [HEADERS.Items, toRow('Items', { id: 'i9', title })])[0];
  assert.equal(back.title, title);
});

test('custom key: Context rows merge by kind + key and incoming wins when there is no updated column', () => {
  const key = r => r.kind + '|' + r.key;
  const r = mergeRows([{ kind: 'keyword', key: 'neuro', value: 'school/neuro' }], [{ kind: 'keyword', key: 'neuro', value: 'school/sound' }, { kind: 'keyword', key: 'nero', value: 'school/neuro' }], key);
  assert.deepEqual(r.rows.map(x => x.value), ['school/sound', 'school/neuro']);
  assert.deepEqual(r.changed, ['keyword|neuro', 'keyword|nero']);
});

test('new end-of-list columns: starred is a boolean, old rows without them read as unstarred', () => {
  const old = toObjects('Items', [HEADERS.Items, ['i1', 'school', 'neuro', 'T', '', '', 'deadline', '', 'open', '', '', '']]);
  assert.equal(old[0].starred, false);
  assert.equal(old[0].order, '');
  const row = toRow('Items', { id: 'i2', starred: true, order: 3 });
  assert.equal(row[HEADERS.Items.indexOf('starred')], true);
  assert.equal(row[HEADERS.Items.indexOf('order')], 3);
  const step = toObjects('Steps', [HEADERS.Steps, ['s1', 'i1', 'Print paperwork', 'FALSE', 1, 'u', '2026-11-11']]);
  assert.equal(step[0].date, '2026-11-11');
});
