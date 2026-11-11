// Store.gs — converts Sheet rows to objects and back, and merges edits.
// Pure functions only: Code.gs does the actual reading and writing.

const BOOLEAN_FIELDS_ = ['done', 'active', 'deleted', 'starred'];

function headersFor_(tab) {
  const H = (typeof module !== 'undefined') ? require('./Schema.js').HEADERS : HEADERS;
  if (!H[tab]) throw new Error('Unknown tab: ' + tab);
  return H[tab];
}

// rows[0] is the header row. Blank rows are skipped.
function toObjects(tab, rows) {
  const cols = headersFor_(tab);
  return (rows || []).slice(1)
    .filter(r => r.some(v => v !== '' && v !== null && v !== undefined))
    .map(r => {
      const o = {};
      cols.forEach((c, i) => { o[c] = cellOut_(c, r[i]); });
      return o;
    });
}

function toRow(tab, obj) {
  return headersFor_(tab).map(c => {
    const v = obj[c];
    if (v === undefined || v === null) return '';
    return BOOLEAN_FIELDS_.includes(c) ? Boolean(v === true || String(v).toUpperCase() === 'TRUE') : v;
  });
}

// Merge incoming objects into existing ones by key. The newer `updated` wins;
// a tie keeps the existing row. Rows without `updated` on either side: incoming wins.
function mergeRows(existing, incoming, keyOf) {
  keyOf = keyOf || (r => r.id);
  const rows = existing.map(r => Object.assign({}, r));
  const index = new Map(rows.map((r, i) => [String(keyOf(r)), i]));
  const changed = [];
  (incoming || []).forEach(inc => {
    const k = String(keyOf(inc));
    if (!index.has(k)) { index.set(k, rows.length); rows.push(Object.assign({}, inc)); changed.push(k); return; }
    const cur = rows[index.get(k)];
    const a = Date.parse(cur.updated), b = Date.parse(inc.updated);
    const incomingWins = (isNaN(a) || isNaN(b)) ? true : b > a;
    if (incomingWins) { rows[index.get(k)] = Object.assign({}, cur, inc); changed.push(k); }
  });
  return { rows: rows, changed: changed };
}

function cellOut_(col, v) {
  if (BOOLEAN_FIELDS_.includes(col)) return v === true || String(v).toUpperCase() === 'TRUE';
  if (v instanceof Date) {
    const p = n => String(n).padStart(2, '0');
    return v.getFullYear() + '-' + p(v.getMonth() + 1) + '-' + p(v.getDate());
  }
  return v === null || v === undefined ? '' : v;
}

if (typeof module !== 'undefined') module.exports = { toObjects, toRow, mergeRows };
