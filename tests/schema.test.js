const test = require('node:test');
const assert = require('node:assert/strict');
const { HEADERS, DEFAULT_CONTEXT, DEFAULT_QUOTES } = require('../apps-script/Schema.js');
const { setupSheet } = require('../apps-script/Setup.js');

test('headers match the spec exactly', () => {
  assert.deepEqual(HEADERS.Items, ['id', 'area', 'group', 'title', 'date', 'time', 'type', 'repeat', 'status', 'notes', 'created', 'updated',
    'starred', 'order']);
  assert.deepEqual(HEADERS.Steps, ['id', 'itemId', 'text', 'done', 'order', 'updated', 'date']);
  assert.deepEqual(HEADERS.Inbox, ['id', 'text', 'source', 'capturedAt', 'guessArea', 'guessGroup', 'guessDate', 'guessType', 'confidence', 'suggestion', 'status',
    'guessTitle', 'guessTime', 'guessParent', 'alternatives']);
  assert.deepEqual(HEADERS.Context, ['kind', 'key', 'value', 'active']);
  assert.deepEqual(HEADERS.Quotes, ['text', 'author', 'active']);
  assert.deepEqual(HEADERS.Log, ['inboxId', 'field', 'guessed', 'chosen', 'at']);
});

test('every tab has unique headers', () => {
  for (const [tab, cols] of Object.entries(HEADERS)) {
    assert.equal(new Set(cols).size, cols.length, tab);
  }
});

test('default context rows fit the Context columns and keywords point at a known group', () => {
  const groups = new Set(DEFAULT_CONTEXT.filter(r => r[0] !== 'keyword' && r[0] !== 'rule').map(r => `${r[0] === 'class' ? 'school' : r[0] === 'project' ? 'projects' : 'life'}/${r[1]}`));
  for (const row of DEFAULT_CONTEXT) {
    assert.equal(row.length, HEADERS.Context.length);
    if (row[0] === 'keyword') assert.ok(groups.has(row[2]), `keyword ${row[1]} -> ${row[2]}`);
  }
  for (const row of DEFAULT_QUOTES) assert.equal(row.length, HEADERS.Quotes.length);
});

// --- a tiny fake of the SpreadsheetApp surface setupSheet uses ---
function fakeSpreadsheet(initialTabs) {
  const tabs = new Map();
  const makeSheet = (name) => {
    const s = {
      name, rows: [], frozen: 0,
      getName: () => s.name,
      getLastRow: () => s.rows.length,
      getLastColumn: () => Math.max(0, ...s.rows.map(r => r.length)),
      getRange: (row, col, nr, nc) => ({
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (s.rows[row - 1 + i] || [])[col - 1 + j] ?? '')),
        setValues: (vals) => { vals.forEach((v, i) => { const r = (s.rows[row - 1 + i] || []).slice(); v.forEach((x, j) => { r[col - 1 + j] = x; }); s.rows[row - 1 + i] = r; }); },
        setFontWeight: () => {},
        setNumberFormat: (f) => { s.format = f; }
      }),
      getMaxRows: () => 1000,
      setFrozenRows: (n) => { s.frozen = n; }
    };
    return s;
  };
  for (const n of initialTabs) tabs.set(n, makeSheet(n));
  return {
    tabs,
    getSheetByName: (n) => tabs.get(n) || null,
    insertSheet: (n) => { const s = makeSheet(n); tabs.set(n, s); return s; },
    getSheets: () => [...tabs.values()],
    deleteSheet: (s) => { tabs.delete(s.name); }
  };
}

test('setupSheet creates all six tabs with headers, seeds defaults, removes an empty Sheet1', () => {
  const ss = fakeSpreadsheet(['Sheet1']);
  setupSheet(ss);
  assert.deepEqual([...ss.tabs.keys()].sort(), Object.keys(HEADERS).sort());
  for (const [tab, cols] of Object.entries(HEADERS)) {
    assert.deepEqual(ss.tabs.get(tab).rows[0], cols);
    assert.equal(ss.tabs.get(tab).frozen, 1);
    assert.equal(ss.tabs.get(tab).format, '@');
  }
  assert.equal(ss.tabs.get('Context').rows.length, 1 + DEFAULT_CONTEXT.length);
  assert.equal(ss.tabs.get('Quotes').rows.length, 1 + DEFAULT_QUOTES.length);
});

test('setupSheet run twice changes nothing the second time', () => {
  const ss = fakeSpreadsheet(['Sheet1']);
  setupSheet(ss);
  ss.tabs.get('Items').rows.push(['x1', 'school']);
  const before = JSON.stringify([...ss.tabs.entries()].map(([k, s]) => [k, s.rows]));
  setupSheet(ss);
  assert.equal(JSON.stringify([...ss.tabs.entries()].map(([k, s]) => [k, s.rows])), before);
});

test('setupSheet adds new columns at the end of an existing tab and leaves its rows alone', () => {
  const ss = fakeSpreadsheet([]);
  const inbox = ss.insertSheet('Inbox');
  inbox.rows.push(HEADERS.Inbox.slice(0, 11), ['in1', 'old capture']);
  setupSheet(ss);
  assert.deepEqual(inbox.rows[0], HEADERS.Inbox);
  assert.deepEqual(inbox.rows[1], ['in1', 'old capture']);
});

test('setupSheet refuses to touch a tab whose headers were reordered', () => {
  const ss = fakeSpreadsheet([]);
  ss.insertSheet('Steps').rows.push(['itemId', 'id']);
  assert.throws(() => setupSheet(ss), /do not match Schema/);
});
