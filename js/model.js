// Pure helpers the views use. No DOM, no network: everything here is tested.

const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const AREA_ORDER = { school: 0, projects: 1, life: 2 };
const pad = n => String(n).padStart(2, '0');
const toUtc = d => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd); };
const fromUtc = ms => { const x = new Date(ms); return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate()); };
export const isOpen = i => !['done', 'cleared', 'archived'].includes(i.status);

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
// Done items stay on their original day (today or future only), shown after open items.
// Starred open non-weekly items are pinned to today (with pinnedFrom set to their real date).
export function groupByDay(items, steps, today, days = 7) {
  const end = addDays(today, days - 1);
  const openSingle = items.filter(i => isOpen(i) && i.date && i.repeat !== 'weekly');
  const doneSingle = items.filter(i => i.status === 'done' && i.date && i.date >= today && i.date <= end && i.repeat !== 'weekly');
  const openMapped = openSingle.map(i => (i.date < today ? { ...i, overdue: true, date: today } : i));

  // Starred open non-weekly items pinned to today
  const starredPins = items.filter(i =>
    isOpen(i) && i.starred && i.repeat !== 'weekly' &&
    !(i.date && i.date <= today)  // not already in today (overdue or today-dated)
  ).map(i => ({ ...i, pinnedFrom: i.date || '', date: today }));

  // Dated steps whose parent is open
  const parentMap = new Map(items.map(i => [i.id, i]));
  const stepEntries = (steps || []).filter(s => {
    if (!s.date) return false;
    const p = parentMap.get(s.itemId);
    return p && isOpen(p);
  }).map(s => {
    const p = parentMap.get(s.itemId);
    const done = s.done === true;
    if (done && s.date < today) return null; // done step dated before today: skip
    const moved = !done && s.date < today;
    return { kind: 'step', id: s.id, itemId: s.itemId, text: s.text, done, date: moved ? today : s.date, order: Number(s.order) || 0, parentTitle: p.title, area: p.area, group: p.group, overdue: moved || undefined };
  }).filter(Boolean);

  const all = openMapped.concat(doneSingle).concat(expandRepeats(items, today, days)).concat(starredPins);
  return Array.from({ length: days }, (_, k) => {
    const date = addDays(today, k);
    const dayItems = all.filter(i => i.date === date && i.date <= end);
    const daySteps = stepEntries.filter(s => s.date === date && s.date <= end);
    const combined = dayItems.concat(daySteps)
      .sort((a, b) => {
        const aDone = (a.kind === 'step' ? a.done : a.status === 'done') ? 1 : 0;
        const bDone = (b.kind === 'step' ? b.done : b.status === 'done') ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        if (k === 0) {
          const aStep = a.kind === 'step' ? 1 : 0;
          const bStep = b.kind === 'step' ? 1 : 0;
          const aStarred = (a.starred && !aDone && !aStep) ? 0 : 1;
          const bStarred = (b.starred && !bDone && !bStep) ? 0 : 1;
          if (aStarred !== bStarred) return aStarred - bStarred;
          const aArea = AREA_ORDER[a.area] ?? 9;
          const bArea = AREA_ORDER[b.area] ?? 9;
          if (aArea !== bArea) return aArea - bArea;
          const aHasTime = a.time ? 0 : 1;
          const bHasTime = b.time ? 0 : 1;
          if (aHasTime !== bHasTime) return aHasTime - bHasTime;
          if (a.time && b.time) return a.time.localeCompare(b.time);
          // Steps sort after untimed items of their area
          if (aStep !== bStep) return aStep - bStep;
          if (aStep && bStep) return a.order - b.order;
          if (!a.time && !b.time) return (a.created || '').localeCompare(b.created || '') || (a.id || '').localeCompare(b.id || '');
          return 0;
        }
        if (!aDone) return (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0) || (a.time || '99:99').localeCompare(b.time || '99:99');
        return (a.time || '99:99').localeCompare(b.time || '99:99');
      });
    return { date, weekday: weekdayOf(date), num: date.slice(8), today: k === 0, items: combined };
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
export function undismissCapture(inboxRow) { return { ...inboxRow, status: 'new' }; }

export function buildSyntheticInboxRow(text, guess, now) {
  return {
    id: newId('in'), text, source: 'page', capturedAt: now, status: 'new', suggestion: '',
    guessArea: guess.area || '', guessGroup: guess.group || '', guessDate: guess.date || '',
    guessType: guess.type || 'deadline', guessTitle: guess.title || '', guessTime: guess.time || '',
    guessParent: guess.parentId || '',
    confidence: JSON.stringify(guess.confidence || {}), alternatives: JSON.stringify(guess.alternatives || {})
  };
}

// ---- Drag reschedule ----
export function reschedule(row, date, now) {
  if (row.repeat === 'weekly') return null;
  return { ...row, date, updated: now };
}

// ---- Inline edit ----
export function applyItemEdit(item, changes, nowIso) {
  const out = { ...item, updated: nowIso };
  if (changes.title && changes.title.trim()) out.title = changes.title.trim();
  if (item.repeat !== 'weekly' && changes.date !== undefined) out.date = changes.date;
  if (changes.time !== undefined) out.time = changes.time;
  if (changes.type) out.type = changes.type;
  if (changes.notes !== undefined) out.notes = changes.notes.trim();
  if (changes.where) {
    const slash = changes.where.indexOf('/');
    const area = slash >= 0 ? changes.where.slice(0, slash) : changes.where;
    const group = slash >= 0 ? changes.where.slice(slash + 1) : '';
    if (area) out.area = area;
    out.group = group;
  }
  return out;
}

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

export function restoreScratchRow(row, text, now) {
  return { ...row, text, deleted: false, updated: now };
}

export function carryToToday(row, today, now) {
  return [
    { ...row, done: true, updated: now },
    { id: newId('sc'), date: today, text: row.text, done: false, order: Date.parse(now), updated: now, deleted: false }
  ];
}

// Pure helper for preserving form-input drafts across renders.
// `inputs` is an array of { formType, formKey, fieldName, value } collected from the DOM.
// Returns a flat map keyed by "formType|formKey|fieldName".
export function collectDrafts(inputs) {
  const map = {};
  for (const { formType, formKey, fieldName, value } of inputs) {
    if (fieldName) map[formType + '|' + formKey + '|' + fieldName] = value;
  }
  return map;
}

// ---- Persistent draft store ----
// Survives redraws and page navigations; cleared on submit / cancel.
const _drafts = {};
const _draftKey = (t, k, f) => t + '|' + k + '|' + f;

export function saveDrafts(inputs) {
  for (const { formType, formKey, fieldName, value } of inputs) {
    if (fieldName) _drafts[_draftKey(formType, formKey, fieldName)] = value;
  }
}
export function loadDrafts() { return { ..._drafts }; }
export function clearDrafts(formType, formKey) {
  const prefix = formType + '|' + formKey + '|';
  for (const k of Object.keys(_drafts)) { if (k.startsWith(prefix)) delete _drafts[k]; }
}
export function clearAllDrafts() { for (const k of Object.keys(_drafts)) delete _drafts[k]; }
export function _draftStoreForTest() { return _drafts; }

// ---- Capture resolution ----
// Combines parser guess, user overrides, and preset area into final capture fields.
export function resolveCapture(guess, overrides, presetArea, groups, presetDate = '') {
  const g = guess || {};
  const conf = g.confidence || {};
  const title = overrides.title !== undefined ? overrides.title : (g.title || '');
  const date = overrides.date !== undefined ? overrides.date : (g.date || presetDate);
  const time = overrides.time !== undefined ? overrides.time : (g.time || '');
  const type = overrides.type || g.type || 'deadline';

  let where;
  if (overrides.where !== undefined) {
    where = overrides.where;
  } else if (conf.where === 'sure') {
    where = (g.area || '') + '/' + (g.group || '');
  } else if (presetArea) {
    if (g.area === presetArea) {
      where = g.area + '/' + (g.group || '');
    } else {
      where = presetArea + '/';
    }
  } else if (g.area) {
    where = g.area + '/' + (g.group || '');
  } else {
    where = '';
  }

  return { where, title, date, time, type };
}

// ---- New group creation ----
const KIND_OF_AREA = { school: 'class', life: 'life', projects: 'project' };
const GROUP_KINDS = new Set(['class', 'life', 'project']);

export function newGroupRows(context, area, name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return [];
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!slug) return [];
  const existingGroupKeys = new Set(
    (context || []).filter(r => GROUP_KINDS.has(r.kind)).map(r => String(r.key))
  );
  let key = slug;
  let n = 2;
  while (existingGroupKeys.has(key)) key = slug + '-' + (n++);
  const kind = KIND_OF_AREA[area] || area;
  const rows = [{ kind, key, value: trimmed, active: true }];
  const keywordKey = trimmed.toLowerCase();
  const existingKeywords = new Set(
    (context || []).filter(r => r.kind === 'keyword').map(r => String(r.key))
  );
  if (!existingKeywords.has(keywordKey)) {
    rows.push({ kind: 'keyword', key: keywordKey, value: area + '/' + key, active: true });
  }
  return rows;
}
