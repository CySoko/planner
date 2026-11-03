import * as api from './api.js';
import * as Q from './queue.js';
import * as M from './model.js';
import { renderLanding } from './views/landing.js';
import { renderArea } from './views/area.js';
import { renderInbox } from './views/inbox.js';
import { esc } from './views/ui.js';

const TAB_KEY = { Items: 'items', Steps: 'steps', Inbox: 'inbox', Context: 'context', Quotes: 'quotes' };
const KEY_OF = { Context: r => r.kind + '|' + r.key, Quotes: r => r.text };
const empty = () => ({ items: [], steps: [], inbox: [], quotes: [], context: [] });

const state = {
  data: Object.assign(empty(), api.loadCache() || {}),
  queue: Q.load(),
  sync: 'loading',
  lastSync: null,
  flushing: false,
  ui: { open: {}, adding: null, offer: null }
};

const $ = sel => document.querySelector(sel);

// ---------- rendering ----------
function render() {
  const now = new Date(), today = M.todayIso(now), nowIso = api.localIso(now);
  $('#today-big').textContent = M.weekdayOf(today) + ' ' + today.slice(5, 7) + '.' + today.slice(8);
  $('#today-sub').textContent = now.toLocaleString('en-US', { month: 'short' }).toLowerCase() + ' ' + now.getFullYear();
  const route = (location.hash.replace(/^#\/?/, '') || '').split('?')[0];
  $('.brand .sub').hidden = !!route;
  const view = $('#view');
  if (['school', 'life', 'projects'].includes(route)) view.innerHTML = renderArea(route, state, today, nowIso);
  else if (route === 'inbox') view.innerHTML = renderInbox(state);
  else view.innerHTML = renderLanding(state, today, nowIso);
  renderStatus();
  const sw = $('.switch');
  sw.setAttribute('aria-checked', String(document.documentElement.dataset.theme !== 'dark'));
}

function renderStatus() {
  const waiting = state.queue.ops.length;
  const label = state.sync === 'offline' ? `● offline · ${waiting} change${waiting === 1 ? '' : 's'} waiting`
    : state.sync === 'saving' ? '● saving…'
    : state.sync === 'loading' ? '● loading…'
    : state.sync === 'error' ? '● couldn’t reach the Sheet · showing saved copy'
    : '● synced';
  const inbox = state.data.inbox.filter(r => r.status === 'new').length;
  $('#status').innerHTML = `<span>${esc(label)}</span><span>inbox ${inbox}</span><span>⌘K new task</span>`;
}

// ---------- data ----------
function applyRows(data, tab, rows) {
  const key = TAB_KEY[tab];
  if (!key) return;
  const keyOf = KEY_OF[tab] || (r => r.id);
  const list = data[key].slice();
  rows.forEach(r => {
    const i = list.findIndex(x => String(keyOf(x)) === String(keyOf(r)));
    if (i >= 0) list[i] = { ...list[i], ...r }; else list.push(r);
  });
  data[key] = list;
}

// Re-apply changes that have not reached the Sheet yet, on top of fresh server data.
function applyQueued(data) {
  state.queue.ops.forEach(op => {
    if (op.kind === 'upsert') applyRows(data, op.payload.tab, op.payload.rows);
    if (op.kind === 'capture' && !data.inbox.some(r => r.id === op.payload.localId)) {
      data.inbox.push(pendingInboxRow(op.payload));
    }
  });
  return data;
}

function pendingInboxRow(p) {
  const g = (typeof parseCapture === 'function' && p.text.length <= 2000) ? safeParse(p.text, p.now) : null;
  return {
    id: p.localId, text: p.text, source: 'page', capturedAt: p.now, status: 'new', suggestion: '',
    guessArea: g?.area || '', guessGroup: g?.group || '', guessDate: g?.date || '', guessType: g?.type || 'deadline',
    guessTitle: g?.title || '', guessTime: g?.time || '', guessParent: g?.parentId || '',
    confidence: JSON.stringify(g?.confidence || {}), alternatives: JSON.stringify(g?.alternatives || {})
  };
}

function safeParse(text, now) {
  try {
    const open = state.data.items.filter(i => i.status !== 'done' && i.status !== 'archived');
    return parseCapture(text, state.data.context, now, open); // eslint-disable-line no-undef
  } catch (e) { return null; }
}

function persist() { api.saveCache(state.data); Q.save(state.queue); }

function saveRows(tab, rows) {
  if (!rows.length) return;
  if (TAB_KEY[tab]) applyRows(state.data, tab, rows);
  state.queue = Q.enqueue(state.queue, { id: M.newId('op'), kind: 'upsert', payload: { tab, rows } });
  persist();
  render();
  flushSoon();
}

async function refresh() {
  try {
    const fresh = await api.loadAll();
    state.data = applyQueued(Object.assign(empty(), {
      items: fresh.items, steps: fresh.steps, inbox: fresh.inbox, quotes: fresh.quotes, context: fresh.context
    }));
    state.lastSync = new Date();
    if (state.sync !== 'saving') state.sync = state.queue.ops.length ? 'offline' : 'synced';
    persist();
  } catch (e) {
    state.sync = navigator.onLine === false ? 'offline' : 'error';
  }
  render();
}

let flushTimer = null;
function flushSoon() { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 400); }

async function flush() {
  if (state.flushing || !state.queue.ops.length) return;
  state.flushing = true; state.sync = 'saving'; renderStatus();
  const snapshot = state.queue;
  const hadCapture = snapshot.ops.some(o => o.kind === 'capture');
  const r = await Q.flush(snapshot, api.sendOp);
  // Failed ops stay; ops added while we were sending are kept after them.
  const snapIds = new Set(snapshot.ops.map(o => o.id));
  state.queue = { ops: [...r.state.ops, ...state.queue.ops.filter(o => !snapIds.has(o.id))] };
  state.sync = r.failed ? 'offline' : 'synced';
  state.flushing = false;
  persist();
  if (hadCapture && r.sent) await refresh(); else render();
}

// ---------- actions ----------
const nowIso = () => api.localIso();

function openPalette() {
  $('#palette').hidden = false;
  const ta = $('#capture'); ta.value = ''; previewCapture(); ta.focus();
}
function closePalette() { $('#palette').hidden = true; $('#capture-error').hidden = true; }

function previewCapture() {
  const text = $('#capture').value.trim();
  const chips = $('#capture-chips');
  if (!text) { chips.innerHTML = '<span class="chip none">type or dictate</span>'; return; }
  if (text.length > 2000) { chips.innerHTML = '<span class="chip none">long paste: Claude sorts it tonight</span>'; return; }
  const g = safeParse(text, nowIso());
  if (!g) { chips.innerHTML = ''; return; }
  const c = (label, value, conf) => `<span class="chip ${conf}">${label}: ${esc(value || '—')}</span>`;
  chips.innerHTML = c('where', g.area ? g.area + '/' + g.group : 'inbox', g.confidence.where) +
    c('when', g.date ? g.date + (g.time ? ' ' + g.time : '') : 'no date', g.confidence.when) +
    c('type', g.type, g.confidence.type);
}

function sendCapture() {
  const text = $('#capture').value.trim();
  const err = $('#capture-error');
  if (!text) { err.textContent = 'Type or dictate something first.'; err.hidden = false; return; }
  const payload = { text, now: nowIso(), localId: 'pending_' + M.newId('c') };
  state.queue = Q.enqueue(state.queue, { id: M.newId('op'), kind: 'capture', payload });
  state.data.inbox.push(pendingInboxRow(payload));
  persist();
  closePalette();
  render();
  flushSoon();
}

function toggleItem(id) {
  const it = state.data.items.find(i => i.id === id);
  if (!it) return;
  saveRows('Items', [{ ...it, status: it.status === 'done' ? 'open' : 'done', updated: nowIso() }]);
}
function toggleStep(id) {
  const s = state.data.steps.find(x => x.id === id);
  if (!s) return;
  saveRows('Steps', [{ ...s, done: s.done !== true, updated: nowIso() }]);
}
function addStep(itemId) {
  const input = document.querySelector(`[data-step-input="${CSS.escape(itemId)}"]`);
  const text = input && input.value.trim();
  if (!text) return;
  const existing = state.data.steps.filter(s => s.itemId === itemId).map(s => Number(s.order) || 0);
  saveRows('Steps', [{ id: M.newId('st'), itemId, text, done: false, order: (existing.length ? Math.max(...existing) : 0) + 1, updated: nowIso() }]);
  const again = document.querySelector(`[data-step-input="${CSS.escape(itemId)}"]`);
  if (again) again.focus();
}

function addItem(form) {
  const f = new FormData(form), now = nowIso();
  const title = String(f.get('title') || '').trim();
  if (!title) return;
  state.ui.adding = null;
  const item = {
    id: M.newId('it'), area: form.dataset.area, group: f.get('group'), title, date: f.get('date') || '', time: f.get('time') || '',
    type: f.get('type') || 'deadline', repeat: f.get('repeat') || 'none', status: 'open', notes: '', created: now, updated: now
  };
  state.ui.open[item.id] = true;
  saveRows('Items', [item]);
}

function acceptInbox(form) {
  const row = state.data.inbox.find(r => r.id === form.dataset.id);
  const f = new FormData(form);
  const where = String(f.get('where') || '');
  const parentId = String(f.get('parentId') || '');
  const errEl = form.querySelector('[data-error]');
  if (!where && !parentId) { errEl.textContent = 'Choose where this goes first.'; errEl.hidden = false; return; }
  const [area, group] = where.split('/');
  const parent = parentId ? state.data.items.find(i => i.id === parentId) : null;
  const chosen = {
    title: String(f.get('title') || '').trim() || row.text, area: parent ? parent.area : area, group: parent ? parent.group : group,
    date: String(f.get('date') || ''), time: String(f.get('time') || ''), type: String(f.get('type') || 'deadline'), parentId, steps: []
  };
  const r = M.acceptCapture(row, chosen, nowIso());
  if (r.log.some(l => l.field === 'group') && !parent) {
    const word = (row.text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []).find(w => !STOP.has(w));
    if (word) state.ui.offer = { word, group: chosen.group, area: chosen.area };
  }
  commitAccept(r);
}
const STOP = new Set(['the', 'and', 'for', 'due', 'with', 'from', 'this', 'that', 'next', 'today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'work', 'start', 'call', 'email', 'send', 'make', 'get', 'buy']);

function acceptSuggestion(id) {
  const row = state.data.inbox.find(r => r.id === id);
  let items = [];
  try { items = JSON.parse(row.suggestion).items || []; } catch (e) { return; }
  commitAccept(M.acceptSuggestion(row, items, nowIso()));
}

function commitAccept(r) {
  if (r.items.length) saveRows('Items', r.items);
  if (r.steps.length) saveRows('Steps', r.steps);
  if (r.log.length) saveRows('Log', r.log);
  saveRows('Inbox', [r.inbox]);
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  if (act === 'toggle-theme') {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('sokogen-theme-v2', next); } catch (err) { /* ignore */ }
    render();
  }
  if (act === 'open-palette') openPalette();
  if (act === 'close-palette') closePalette();
  if (act === 'send-capture') sendCapture();
  if (act === 'toggle-item') toggleItem(id);
  if (act === 'toggle-step') toggleStep(id);
  if (act === 'add-step') addStep(id);
  if (act === 'toggle-card') { state.ui.open[id] = !state.ui.open[id]; el.closest('.card').classList.toggle('open'); el.setAttribute('aria-expanded', String(!!state.ui.open[id])); }
  if (act === 'toggle-add') { state.ui.adding = state.ui.adding === el.dataset.area ? null : el.dataset.area; render(); }
  if (act === 'dismiss') { const row = state.data.inbox.find(r => r.id === id); if (row) saveRows('Inbox', [M.dismissCapture(row)]); }
  if (act === 'accept-suggestion') acceptSuggestion(id);
  if (act === 'use-alt') {
    const field = el.closest('form').querySelector(`[name="${el.dataset.field}"]`);
    if (field) { field.value = el.dataset.value; field.closest('label').classList.remove('unsure'); }
  }
  if (act === 'offer-no') { state.ui.offer = null; render(); }
  if (act === 'offer-yes') {
    const o = state.ui.offer; state.ui.offer = null;
    saveRows('Context', [{ kind: 'keyword', key: o.word, value: o.area + '/' + o.group, active: true }]);
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.dataset.form === 'add-item') { e.preventDefault(); addItem(form); }
  if (form.dataset.form === 'accept') { e.preventDefault(); acceptInbox(form); }
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
  if (e.key === 'Escape' && !$('#palette').hidden) closePalette();
  if (e.target.id === 'capture' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCapture(); }
  if (e.target.dataset && e.target.dataset.stepInput && e.key === 'Enter') { e.preventDefault(); addStep(e.target.dataset.stepInput); }
});
document.addEventListener('input', (e) => { if (e.target.id === 'capture') previewCapture(); });

window.addEventListener('hashchange', () => { state.ui.adding = null; render(); window.scrollTo(0, 0); });
window.addEventListener('online', () => { flush(); refresh(); });
window.addEventListener('offline', () => { state.sync = 'offline'; renderStatus(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { flush(); refresh(); } });
setInterval(() => { if (state.queue.ops.length) flush(); }, 30000);
setInterval(render, 60000);

render();
refresh().then(flush);
