// Code.gs — the web app. The planner page and the Siri shortcut talk only to this.
//   GET  ?action=all                                  -> everything the page needs
//   POST {action:'capture', text, source, now}         -> new Inbox row
//   POST {action:'upsert', tab, rows}                  -> merge rows (newer `updated` wins)
// POST bodies are sent as text/plain JSON (no CORS preflight).

const LONG_CAPTURE_ = 2000;
const SOURCES_ = ['page', 'siri', 'claude'];
const ISO_WITH_OFFSET_ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

function lib_() {
  if (typeof module !== 'undefined') {
    return Object.assign({}, require('./Schema.js'), require('./Parse.js'), require('./Store.js'));
  }
  return { HEADERS: HEADERS, parseCapture: parseCapture, toObjects: toObjects, toRow: toRow, mergeRows: mergeRows };
}

// ---------- pure (tested) ----------
function validateCapture(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be JSON' };
  if (body.action === 'capture') {
    if (typeof body.text !== 'string' || !body.text.trim()) return { ok: false, error: 'Capture is empty' };
    if (SOURCES_.indexOf(body.source) < 0) return { ok: false, error: 'source must be page, siri or claude' };
    if (!ISO_WITH_OFFSET_.test(String(body.now || ''))) return { ok: false, error: 'now must be an ISO time with an offset' };
    return { ok: true };
  }
  if (body.action === 'upsert') {
    if (!lib_().HEADERS[body.tab]) return { ok: false, error: 'Unknown tab: ' + body.tab };
    if (!Array.isArray(body.rows)) return { ok: false, error: 'rows must be a list' };
    return { ok: true };
  }
  return { ok: false, error: 'Unknown action' };
}

function buildInboxRow(body, context, openItems, id) {
  const row = {
    id: id, text: body.text, source: body.source, capturedAt: body.now, status: 'new', suggestion: '',
    guessArea: '', guessGroup: '', guessDate: '', guessType: '', guessTitle: '', guessTime: '', guessParent: '',
    confidence: JSON.stringify({ where: 'none', when: 'none', type: 'none' }), alternatives: JSON.stringify({})
  };
  if (body.text.length > LONG_CAPTURE_) return row;
  const g = lib_().parseCapture(body.text, context, body.now, openItems);
  row.guessArea = g.area || ''; row.guessGroup = g.group || ''; row.guessDate = g.date || '';
  row.guessType = g.type; row.guessTitle = g.title; row.guessTime = g.time || ''; row.guessParent = g.parentId || '';
  row.confidence = JSON.stringify(g.confidence);
  row.alternatives = JSON.stringify(g.alternatives);
  return row;
}

function keyFor(tab) {
  if (tab === 'Context') return r => r.kind + '|' + r.key;
  if (tab === 'Quotes') return r => r.text;
  if (tab === 'Log') return r => r.inboxId + '|' + r.field + '|' + r.at;
  return r => r.id;
}

// ---------- Apps Script glue (checked by hand after each deploy) ----------
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'all';
    if (action !== 'all') return json_({ ok: false, error: 'Unknown action' });
    return json_({
      ok: true,
      items: readTab_('Items'), steps: readTab_('Steps'), inbox: readTab_('Inbox'),
      quotes: readTab_('Quotes'), context: readTab_('Context'), scratch: readTab_('Scratch'),
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  let lock = null;
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || 'null');
    const v = validateCapture(body);
    if (!v.ok) return json_(v);
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    if (body.action === 'capture') {
      const openItems = readTab_('Items').filter(i => i.status !== 'done' && i.status !== 'archived');
      const row = buildInboxRow(body, readTab_('Context'), openItems, 'in_' + Utilities.getUuid().slice(0, 8));
      sheet_('Inbox').appendRow(lib_().toRow('Inbox', row));
      return json_({ ok: true, inbox: row });
    }
    return json_({ ok: true, changed: upsert_(body.tab, body.rows) });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    if (lock) lock.releaseLock();
  }
}

function upsert_(tab, incoming) {
  const L = lib_();
  const sheet = sheet_(tab);
  const raw = sheet.getDataRange().getValues();
  const keyOf = keyFor(tab);
  // Map each key to its real sheet row, so a blank row in the middle can never shift a write.
  const rowNumber = new Map();
  raw.slice(1).forEach((r, idx) => {
    const o = L.toObjects(tab, [raw[0], r])[0];
    if (o) rowNumber.set(String(keyOf(o)), idx + 2);
  });
  const merged = L.mergeRows(L.toObjects(tab, raw), incoming, keyOf);
  const width = L.HEADERS[tab].length;
  merged.changed.forEach(k => {
    const values = [L.toRow(tab, merged.rows.find(r => String(keyOf(r)) === k))];
    if (rowNumber.has(k)) sheet.getRange(rowNumber.get(k), 1, 1, width).setValues(values);
    else sheet.appendRow(values[0]);
  });
  return merged.changed;
}

function readTab_(tab) { return lib_().toObjects(tab, sheet_(tab).getDataRange().getValues()); }
function sheet_(tab) {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab);
  if (!s) throw new Error('Missing tab ' + tab + '. Run setupSheet.');
  return s;
}
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

if (typeof module !== 'undefined') module.exports = { validateCapture, buildInboxRow, keyFor, upsert_ };
