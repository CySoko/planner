// Pure helpers the views use. No DOM, no network: everything here is tested.

const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const pad = n => String(n).padStart(2, '0');
const toUtc = d => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd); };
const fromUtc = ms => { const x = new Date(ms); return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate()); };
const isOpen = i => i.status !== 'done' && i.status !== 'archived';

export function todayIso(d = new Date()) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function addDays(iso, n) { return fromUtc(toUtc(iso) + n * 86400000); }
export function daysBetween(a, b) { return Math.round((toUtc(b) - toUtc(a)) / 86400000); }
export function weekdayOf(iso) { return WD[new Date(toUtc(iso)).getUTCDay()]; }

export function quoteForDate(iso, quotes) {
  const active = (quotes || []).filter(q => q.active === true || String(q.active).toUpperCase() === 'TRUE');
  if (!active.length) return null;
  const [y] = iso.split('-').map(Number);
  const dayOfYear = Math.round((toUtc(iso) - Date.UTC(y, 0, 1)) / 86400000) + 1;
  return active[dayOfYear % active.length];
}

// Weekly items: every occurrence on or after `from`, within `days`.
export function expandRepeats(items, from, days) {
  const end = addDays(from, days - 1), out = [];
  items.filter(i => isOpen(i) && i.repeat === 'weekly' && i.date).forEach(i => {
    let d = i.date;
    while (d < from) d = addDays(d, 7);
    for (; d <= end; d = addDays(d, 7)) out.push({ ...i, date: d, occurrence: true });
  });
  return out;
}

// The itinerary: one block per day; overdue open items are pulled onto today.
export function groupByDay(items, steps, today, days = 7) {
  const end = addDays(today, days - 1);
  const single = items.filter(i => isOpen(i) && i.date && i.repeat !== 'weekly');
  const all = single.map(i => (i.date < today ? { ...i, overdue: true, date: today } : i)).concat(expandRepeats(items, today, days));
  return Array.from({ length: days }, (_, k) => {
    const date = addDays(today, k);
    const dayItems = all.filter(i => i.date === date && i.date <= end)
      .sort((a, b) => (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0) || (a.time || '99:99').localeCompare(b.time || '99:99'));
    return { date, weekday: weekdayOf(date), num: date.slice(8), today: k === 0, items: dayItems };
  });
}

export function areaSummary(items, steps, area, today) {
  const open = items.filter(i => i.area === area && isOpen(i));
  const dated = open.filter(i => i.date).sort((a, b) => a.date.localeCompare(b.date));
  const ids = new Set(open.map(i => i.id));
  const s = steps.filter(x => ids.has(x.itemId));
  const done = s.filter(x => x.done === true).length;
  return {
    open: open.length,
    next: dated.length ? { date: dated[0].date, title: dated[0].title } : null,
    pct: s.length ? Math.round(done / s.length * 100) : 0
  };
}

export function countdown(date, today) {
  if (!date) return 'no date';
  const n = daysBetween(today, date);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  return n > 0 ? 'in ' + n + 'd' : (-n) + 'd overdue';
}

// A project is stalled when nothing in it was checked off for `threshold` days.
export function isStalled(group, items, steps, nowIso, threshold = 7) {
  const its = items.filter(i => i.group === group && isOpen(i));
  if (!its.length) return false;
  const ids = new Set(its.map(i => i.id));
  const checked = steps.filter(s => ids.has(s.itemId) && s.done === true).map(s => Date.parse(s.updated)).filter(n => !isNaN(n));
  const last = checked.length ? Math.max(...checked) : Math.min(...its.map(i => Date.parse(i.created)).filter(n => !isNaN(n)));
  if (!isFinite(last)) return false;
  return (Date.parse(nowIso) - last) / 86400000 > threshold;
}

export function nextAction(group, items, steps) {
  const its = items.filter(i => i.group === group && isOpen(i))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  for (const i of its) {
    const s = steps.filter(x => x.itemId === i.id && x.done !== true).sort((a, b) => Number(a.order) - Number(b.order));
    if (s.length) return s[0];
  }
  return null;
}

export function newId(prefix) { return prefix + '_' + Math.random().toString(36).slice(2, 10); }

// ---- Inbox ----
const LOGGED = [['area', 'guessArea'], ['group', 'guessGroup'], ['title', 'guessTitle'], ['date', 'guessDate'], ['time', 'guessTime'], ['type', 'guessType']];

function makeSteps(itemId, texts, now, startOrder) {
  return texts.filter(t => String(t).trim()).map((text, k) => ({
    id: newId('st'), itemId, text: String(text).trim(), done: false, order: startOrder + k, updated: now
  }));
}

// File one capture as Cy chose it. Every field that differs from the parser's guess is logged.
export function acceptCapture(inboxRow, chosen, now) {
  const base = Date.parse(now) || Date.now();
  const log = LOGGED
    .filter(([f, g]) => String(inboxRow[g] || '') !== String(chosen[f] || ''))
    .map(([f, g]) => ({ inboxId: inboxRow.id, field: f, guessed: String(inboxRow[g] || ''), chosen: String(chosen[f] || ''), at: now }));
  if (chosen.parentId) {
    return { items: [], steps: makeSteps(chosen.parentId, [chosen.title].concat(chosen.steps || []), now, base), inbox: { ...inboxRow, status: 'accepted' }, log };
  }
  const item = {
    id: newId('it'), area: chosen.area, group: chosen.group, title: chosen.title, date: chosen.date || '', time: chosen.time || '',
    type: chosen.type || 'deadline', repeat: chosen.repeat || 'none', status: 'open', notes: '', created: now, updated: now
  };
  return { items: [item], steps: makeSteps(item.id, chosen.steps || [], now, base), inbox: { ...inboxRow, status: 'accepted' }, log };
}

// File every item in a Claude suggestion. Suggestions are not parser guesses, so nothing is logged.
export function acceptSuggestion(inboxRow, suggestionItems, now) {
  const out = { items: [], steps: [], inbox: { ...inboxRow, status: 'accepted' }, log: [] };
  suggestionItems.forEach((s, k) => {
    const r = acceptCapture({}, { ...s, parentId: s.parentId || '' }, now);
    out.items.push(...r.items);
    out.steps.push(...r.steps.map(x => ({ ...x, order: x.order + k * 100 })));
  });
  return out;
}

export function dismissCapture(inboxRow) { return { ...inboxRow, status: 'dismissed' }; }

// ---- Scratch ----

export function scratchForDate(rows, date) {
  return (rows || [])
    .filter(r => r.date === date && !r.deleted)
    .sort((a, b) => Number(a.order) - Number(b.order));
}

export function insertAfter(rows, date, afterId, now) {
  const sorted = scratchForDate(rows, date);
  const idx = afterId ? sorted.findIndex(r => r.id === afterId) : -1;
  const after = idx >= 0 ? sorted[idx] : null;
  const next = after ? sorted[idx + 1] : (!afterId && sorted.length ? sorted[0] : null);
  const afterOrder = after ? Number(after.order) : 0;
  const nextOrder = next ? Number(next.order) : afterOrder + 2;
  const gap = nextOrder - afterOrder;
  const order = gap > 0.001 ? afterOrder + gap / 2 : afterOrder + 1;
  return { id: newId('sc'), date, text: '', done: false, order, updated: now, deleted: false };
}

export function carryToToday(row, today, now) {
  return [
    { ...row, done: true, updated: now },
    { id: newId('sc'), date: today, text: row.text, done: false, order: Date.parse(now), updated: now, deleted: false }
  ];
}
