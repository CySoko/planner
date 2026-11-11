import * as api from './api.js';
import * as Q from './queue.js';
import * as M from './model.js';
import { renderLanding } from './views/landing.js';
import { renderArea } from './views/area.js';
import { renderInbox } from './views/inbox.js';
import { renderScratch } from './views/scratch.js';
import { esc, allGroups, groupName, AREA_LABEL, shortDate } from './views/ui.js';

const TAB_KEY = { Items: 'items', Steps: 'steps', Inbox: 'inbox', Context: 'context', Quotes: 'quotes', Scratch: 'scratch' };
const KEY_OF = { Context: r => r.kind + '|' + r.key, Quotes: r => r.text };
const empty = () => ({ items: [], steps: [], inbox: [], quotes: [], context: [], scratch: [] });

const state = {
  data: Object.assign(empty(), api.loadCache() || {}),
  queue: Q.load(),
  sync: 'loading',
  lastSync: null,
  flushing: false,
  ui: { open: {}, offer: null, editing: null, scratchDate: null, scratchFocus: null }
};

const $ = sel => document.querySelector(sel);

// ---------- rendering ----------

// Collect { formType, formKey, fieldName, value } for every named input inside [data-form]
// elements and [data-step-input] inputs in `el`. Used to survive a full innerHTML swap.
function snapshotInputs(el) {
  const inputs = [];
  el.querySelectorAll('[data-form]').forEach(form => {
    const formType = form.dataset.form;
    const formKey = form.dataset.id || form.dataset.area || '';
    form.querySelectorAll('input, select, textarea').forEach(field => {
      if (field.name) inputs.push({ formType, formKey, fieldName: field.name, value: field.value });
    });
  });
  el.querySelectorAll('[data-step-input]').forEach(field => {
    inputs.push({ formType: 'step', formKey: field.dataset.stepInput, fieldName: '__v', value: field.value });
  });
  return inputs;
}

function restoreInputs(el, drafts) {
  el.querySelectorAll('[data-form]').forEach(form => {
    const formType = form.dataset.form;
    const formKey = form.dataset.id || form.dataset.area || '';
    form.querySelectorAll('input, select, textarea').forEach(field => {
      if (!field.name) return;
      const v = drafts[formType + '|' + formKey + '|' + field.name];
      if (v !== undefined) field.value = v;
    });
  });
  el.querySelectorAll('[data-step-input]').forEach(field => {
    const v = drafts['step|' + field.dataset.stepInput + '|__v'];
    if (v !== undefined) field.value = v;
  });
}

function render() {
  const now = new Date(), today = M.todayIso(now), nowIso = api.localIso(now);
  $('#today-big').textContent = M.weekdayOf(today) + ' ' + today.slice(5, 7) + '.' + today.slice(8);
  $('#today-sub').textContent = now.toLocaleString('en-US', { month: 'short' }).toLowerCase() + ' ' + now.getFullYear();
  const route = (location.hash.replace(/^#\/?/, '') || '').split('?')[0];
  if (!state.ui.scratchDate || state.ui.scratchDate > today) state.ui.scratchDate = today;

  // If a scratch input has focus, capture its current value so typing is never lost.
  const scratchActive = document.activeElement && document.activeElement.dataset.scratchInput !== undefined;
  let scratchSnap = null;
  if (scratchActive && !route) {
    const el = document.activeElement;
    scratchSnap = { id: el.dataset.id, value: el.value, sel: el.selectionStart };
    if (el.dataset.id === '__new') el.value = ''; // prevent focusout during innerHTML from scheduling scratchCreateFirst
    state.ui.scratchFocus = { id: el.dataset.id };
  }

  const view = $('#view');

  // Capture which non-scratch input has focus so we can restore it after the redraw.
  let focusSnap = null;
  const ae = document.activeElement;
  if (ae && view.contains(ae) && !scratchActive) {
    if (ae.dataset.stepInput) {
      focusSnap = { type: 'step', key: ae.dataset.stepInput, sel: ae.selectionStart };
    } else if (ae.name && ae.closest('[data-form]')) {
      const form = ae.closest('[data-form]');
      focusSnap = { type: 'form', formType: form.dataset.form, formKey: form.dataset.id || form.dataset.area || '', fieldName: ae.name, sel: ae.selectionStart };
    }
  }

  M.saveDrafts(snapshotInputs(view));
  if (['school', 'life', 'projects'].includes(route)) view.innerHTML = renderArea(route, state, today, nowIso);
  else if (route === 'inbox') view.innerHTML = renderInbox(state);
  else view.innerHTML = renderLanding(state, today, nowIso);
  restoreInputs(view, M.loadDrafts());

  // Check if the week scroll is already at the end (no overflow → no fade).
  const wkEl = view.querySelector('.wk');
  if (wkEl) updateWkFade(wkEl);

  // Restore value and focus to the active scratch input.
  if (scratchSnap) {
    const all = document.querySelectorAll(`[data-scratch-input][data-id="${CSS.escape(scratchSnap.id)}"]`);
    const el = Array.from(all).find(e => e.offsetParent !== null) || all[0];
    if (el) { el.value = scratchSnap.value; el.focus(); el.setSelectionRange(scratchSnap.sel, scratchSnap.sel); }
  }

  // Restore focus to non-scratch inputs.
  if (focusSnap && focusSnap.type === 'step') {
    const t = view.querySelector(`[data-step-input="${CSS.escape(focusSnap.key)}"]`);
    if (t) { t.focus(); if (focusSnap.sel != null) t.setSelectionRange(focusSnap.sel, focusSnap.sel); }
  } else if (focusSnap && focusSnap.type === 'form') {
    view.querySelectorAll(`[data-form="${CSS.escape(focusSnap.formType)}"]`).forEach(form => {
      const key = form.dataset.id || form.dataset.area || '';
      if (key !== focusSnap.formKey) return;
      const f = form.querySelector(`[name="${CSS.escape(focusSnap.fieldName)}"]`);
      if (f) { f.focus(); if (focusSnap.sel != null && f.setSelectionRange) f.setSelectionRange(focusSnap.sel, focusSnap.sel); }
    });
  }

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

// ---------- scratch ----------
function saveScratchRowQuiet(row) {
  const idx = state.data.scratch.findIndex(r => r.id === row.id);
  if (idx >= 0) state.data.scratch[idx] = row; else state.data.scratch.push(row);
  state.queue = Q.enqueue(state.queue, { id: M.newId('op'), kind: 'upsert', payload: { tab: 'Scratch', rows: [row] } });
  persist();
  flushSoon();
}

function redrawScratch() {
  const today = M.todayIso();
  const date = state.ui.scratchDate || today;
  const rows = M.scratchForDate(state.data.scratch, date);
  const html = renderScratch(rows, date, today);
  document.querySelectorAll('.scratch-panel').forEach(panel => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    panel.replaceWith(tmp.firstElementChild);
  });
}

function focusScratchBullet(id) {
  requestAnimationFrame(() => {
    const all = document.querySelectorAll(`[data-scratch-input][data-id="${CSS.escape(id)}"]`);
    const el = Array.from(all).find(e => e.offsetParent !== null) || all[0];
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  });
}

let scratchSaveTimer = null;
function scheduleScratchSave(id, text) {
  clearTimeout(scratchSaveTimer);
  scratchSaveTimer = setTimeout(() => flushScratchSave(id, text), 600);
}
function flushScratchSave(id, text) {
  clearTimeout(scratchSaveTimer);
  const row = state.data.scratch.find(r => r.id === id);
  if (row && row.text !== text) saveScratchRowQuiet({ ...row, text, updated: nowIso() });
}

function scratchEnter(el) {
  const id = el.dataset.id;
  const text = el.value.trim();
  const date = state.ui.scratchDate || M.todayIso();
  if (id === '__new') {
    if (!text) return;
    el.value = ''; // prevent focusout during redrawScratch from scheduling scratchCreateFirst
    const sorted = M.scratchForDate(state.data.scratch, date);
    const lastId = sorted.length ? sorted[sorted.length - 1].id : null;
    const row = { ...M.insertAfter(state.data.scratch, date, lastId, nowIso()), text };
    saveScratchRowQuiet(row);
    redrawScratch();
    focusScratchBullet('__new');
  } else {
    flushScratchSave(id, text);
    const next = M.insertAfter(state.data.scratch, date, id, nowIso());
    saveScratchRowQuiet(next);
    redrawScratch();
    focusScratchBullet(next.id);
  }
}

function scratchDeleteBullet(el) {
  const id = el.dataset.id;
  if (id === '__new') return;
  const date = state.ui.scratchDate || M.todayIso();
  const sorted = M.scratchForDate(state.data.scratch, date);
  const idx = sorted.findIndex(r => r.id === id);
  const prevId = idx > 0 ? sorted[idx - 1].id : null;
  const row = state.data.scratch.find(r => r.id === id);
  if (row) saveScratchRowQuiet({ ...row, deleted: true, updated: nowIso() });
  redrawScratch();
  if (prevId) focusScratchBullet(prevId);
  if (scratchLastText.id === id && scratchLastText.text) {
    const thatText = scratchLastText.text;
    toastUndo = () => {
      const r = state.data.scratch.find(r => r.id === id);
      if (r) saveScratchRowQuiet(M.restoreScratchRow(r, thatText, nowIso()));
      redrawScratch();
      focusScratchBullet(id);
    };
    showToast('<span>Line deleted</span><button class="toast-btn" data-act="undo-toast">undo</button><button class="toast-btn" data-act="dismiss-toast" aria-label="Dismiss">\u2715</button>');
  }
}

function scratchCreateFirst(text) {
  const date = state.ui.scratchDate || M.todayIso();
  const sorted = M.scratchForDate(state.data.scratch, date);
  const lastId = sorted.length ? sorted[sorted.length - 1].id : null;
  const row = { ...M.insertAfter(state.data.scratch, date, lastId, nowIso()), text };
  saveScratchRowQuiet(row);
  redrawScratch();
}

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
      items: fresh.items, steps: fresh.steps, inbox: fresh.inbox, quotes: fresh.quotes, context: fresh.context,
      scratch: fresh.scratch || []
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

let capLastText = '';
let capOverrides = {};
let capGuess = null;
let capExpanded = false;
let capPreset = '';
let toastTimer = null;
let toastUndo = null;
let scratchLastText = { id: '', text: '' };
let scratchDeleting = false;

function openPalette(presetArea) {
  const pal = $('#palette');
  if (pal.hidden) {
    capLastText = ''; capOverrides = {}; capGuess = null; capExpanded = false; capPreset = '';
    $('#capture').value = '';
  }
  if (presetArea) {
    capPreset = presetArea;
    capExpanded = false;
  }
  hideToast();
  pal.hidden = false;
  const ta = $('#capture'); previewCapture(); ta.focus();
}
function closePalette() { $('#palette').hidden = true; $('#capture-error').hidden = true; }
function showToast(html) {
  clearTimeout(toastTimer);
  const el = $('#toast');
  el.innerHTML = html;
  el.hidden = false;
  toastTimer = setTimeout(hideToast, 8000);
}
function hideToast() {
  clearTimeout(toastTimer);
  $('#toast').hidden = true;
  toastUndo = null;
}
function undoToast() {
  if (!toastUndo) return;
  toastUndo();
  toastUndo = null;
  const el = $('#toast');
  el.innerHTML = '<span>Undone</span><button class="toast-btn" data-act="dismiss-toast" aria-label="Dismiss">\u2715</button>';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 3000);
}

function previewCapture() {
  const text = $('#capture').value.trim();
  const fields = $('#cap-fields');

  if (!text) {
    fields.innerHTML = '<div class="cap-hint mono">type or dictate</div>';
    capGuess = null;
    return;
  }

  const lines = text.split('\n').length;
  if (text.length > 2000 || lines > 3) {
    fields.innerHTML = `<div class="cap-foot"><span class="cap-hint">Long paste \u2014 Claude sorts it tonight.</span><div class="row-end"><button class="btn" data-act="close-palette">esc</button><button class="btn primary" data-act="send-capture">send to inbox \u21b5</button></div></div>`;
    capGuess = null;
    return;
  }

  if (text !== capLastText) {
    const savedWhere = capOverrides.where;
    capOverrides = {};
    if (savedWhere !== undefined) capOverrides.where = savedWhere;
  }
  capLastText = text;

  const g = safeParse(text, nowIso());
  if (!g) { fields.innerHTML = ''; capGuess = null; return; }
  capGuess = g;

  const groups = allGroups(state.data.context);
  const resolved = M.resolveCapture(g, capOverrides, capPreset, groups);
  const whereVal = resolved.where;
  const titleVal = resolved.title;
  const dateVal = resolved.date;
  const timeVal = resolved.time;
  const typeVal = resolved.type;

  const [destArea, destGroup] = (whereVal || '').split('/');
  const destName = destGroup ? groupName(state.data.context, destGroup) : '';
  const pending = resolved.pendingArea;
  const destLabel = destArea ? `add to ${destName}` : (pending ? 'pick where' : 'choose where');

  // Compact summary (default) vs full grid (expanded)
  const summaryParts = [];
  if (destArea) {
    summaryParts.push(`${esc(AREA_LABEL[destArea])} \u00b7 ${esc(destName)}`);
  } else if (pending) {
    const hint = pending === 'school' ? 'pick a class' : pending === 'life' ? 'pick a part of life' : 'pick a project';
    summaryParts.push(`${esc(AREA_LABEL[pending])} \u00b7 <span class="cap-pending">${esc(hint)}</span>`);
  }
  if (dateVal) summaryParts.push(esc(shortDate(dateVal)));
  summaryParts.push(esc(typeVal));
  const summaryLine = summaryParts.join(' \u00a0\u2022\u00a0 ');

  if (!capExpanded) {
    fields.innerHTML = `
      <div class="cap-summary">
        <span class="cap-summary-text">${titleVal ? '<b>' + esc(titleVal) + '</b> \u2014 ' : ''}${summaryLine}</span>
        <button class="btn small" data-act="toggle-cap-expand">more \u25b8</button>
      </div>
      <div class="cap-foot">
        <button class="btn" data-act="close-palette">esc</button>
        <button class="btn" data-act="send-capture">inbox instead</button>
        <button class="btn primary" data-act="file-capture" ${!whereVal && !pending ? 'disabled' : ''}>${esc(destLabel)} \u21b5</button>
      </div>`;
    return;
  }

  const whereOpts = (whereVal ? '' : '<option value="">\u2014</option>') +
    groups.map(gr => `<option value="${esc(gr.area + '/' + gr.key)}" ${gr.area + '/' + gr.key === whereVal ? 'selected' : ''}>${esc(AREA_LABEL[gr.area])} \u00b7 ${esc(gr.name)}</option>`).join('');
  const typeOpts = ['deadline', 'event', 'do-date'].map(t => `<option ${t === typeVal ? 'selected' : ''}>${t}</option>`).join('');

  fields.innerHTML = `
    <div class="cap-grid">
      <label class="cap-f">Title<input type="text" name="cap-title" value="${esc(titleVal)}"></label>
      <label class="cap-f">Where<select name="cap-where">${whereOpts}</select></label>
      <label class="cap-f">Date<input type="date" name="cap-date" value="${esc(dateVal)}"></label>
      <label class="cap-f">Time<input type="time" name="cap-time" value="${esc(timeVal)}"></label>
      <label class="cap-f">Type<select name="cap-type">${typeOpts}</select></label>
    </div>
    <div class="cap-foot">
      <button class="btn small" data-act="toggle-cap-expand">\u25c2 less</button>
      <button class="btn" data-act="close-palette">esc</button>
      <button class="btn" data-act="send-capture">inbox instead</button>
      <button class="btn primary" data-act="file-capture" ${!whereVal ? 'disabled' : ''}>${esc(destLabel)} \u21b5</button>
    </div>`;
}

function fileCapture() {
  const text = $('#capture').value.trim();
  const err = $('#capture-error');
  if (!text || !capGuess) { err.textContent = 'Type or dictate something first.'; err.hidden = false; return; }

  const groups = allGroups(state.data.context);
  const resolved = M.resolveCapture(capGuess, capOverrides, capPreset, groups);
  const where = resolved.where;
  if (!where && !capExpanded) {
    capExpanded = true;
    previewCapture();
    const sel = document.querySelector('[name="cap-where"]');
    if (sel) sel.focus();
    return;
  }
  if (!where) { err.textContent = 'Choose where this goes.'; err.hidden = false; return; }

  const title = resolved.title;
  const date = resolved.date;
  const time = resolved.time;
  const type = resolved.type;
  const [area, group] = where.split('/');
  const now = nowIso();

  const synth = M.buildSyntheticInboxRow(text, capGuess, now);
  const chosen = { area, group, title: title || capGuess.title, date, time, type, parentId: capGuess.parentId || '', steps: [] };
  const r = M.acceptCapture(synth, chosen, now);

  $('#capture').value = '';
  closePalette();

  if (r.items.length) saveRows('Items', r.items);
  if (r.steps.length) saveRows('Steps', r.steps);
  if (r.log.length) saveRows('Log', r.log);

  // Toast
  const today = M.todayIso();
  const weekEnd = M.addDays(today, 6);
  if (chosen.parentId) {
    const parent = state.data.items.find(i => i.id === chosen.parentId);
    showToast(`<span>Step added to ${esc(parent ? parent.title : chosen.parentId)}</span><button class="toast-btn" data-act="dismiss-toast" aria-label="Dismiss">\u2715</button>`);
  } else if (r.items.length) {
    const it = r.items[0];
    const gName = groupName(state.data.context, it.group);
    let msg = `Added to ${esc(AREA_LABEL[it.area])} \u00b7 ${esc(gName)}`;
    if (it.date) {
      msg += ` \u00b7 ${esc(shortDate(it.date))}`;
      if (it.date > weekEnd) msg += ' (outside this week)';
    } else {
      msg += ` \u00b7 no date, find it on the ${esc(AREA_LABEL[it.area])} page`;
    }
    toastUndo = () => {
      const fresh = state.data.items.find(i => i.id === it.id);
      if (fresh) saveRows('Items', [{ ...fresh, status: 'archived', updated: nowIso() }]);
    };
    showToast(`<span>${msg}</span><button class="toast-btn" data-act="undo-toast">undo</button><button class="toast-btn" data-act="dismiss-toast" aria-label="Dismiss">\u2715</button>`);
  }

  render();
}

function sendCapture() {
  const text = $('#capture').value.trim();
  const err = $('#capture-error');
  if (!text) { err.textContent = 'Type or dictate something first.'; err.hidden = false; return; }
  const payload = { text, now: nowIso(), localId: 'pending_' + M.newId('c') };
  state.queue = Q.enqueue(state.queue, { id: M.newId('op'), kind: 'capture', payload });
  state.data.inbox.push(pendingInboxRow(payload));
  $('#capture').value = '';
  closePalette();
  persist();
  showToast(`<span>Sent to Inbox to sort later</span><button class="toast-btn" data-act="dismiss-toast" aria-label="Dismiss">\u2715</button>`);
  render();
  flushSoon();
}

function toggleItem(id) {
  const it = state.data.items.find(i => i.id === id);
  if (!it) return;
  const wasDone = it.status === 'done';
  saveRows('Items', [{ ...it, status: wasDone ? 'open' : 'done', updated: nowIso() }]);
  if (!wasDone) {
    toastUndo = () => {
      const fresh = state.data.items.find(i => i.id === id);
      if (fresh) saveRows('Items', [{ ...fresh, status: 'open', updated: nowIso() }]);
    };
    showToast(`<span>${esc(it.title)} done</span><button class="toast-btn" data-act="undo-toast">undo</button><button class="toast-btn" data-act="dismiss-toast" aria-label="Dismiss">\u2715</button>`);
  }
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
  input.value = '';
  M.clearDrafts('step', itemId);
  const existing = state.data.steps.filter(s => s.itemId === itemId).map(s => Number(s.order) || 0);
  saveRows('Steps', [{ id: M.newId('st'), itemId, text, done: false, order: (existing.length ? Math.max(...existing) : 0) + 1, updated: nowIso() }]);
  const again = document.querySelector(`[data-step-input="${CSS.escape(itemId)}"]`);
  if (again) again.focus();
}


function acceptInbox(form) {
  const row = state.data.inbox.find(r => r.id === form.dataset.id);
  const f = new FormData(form);
  form.reset();
  M.clearDrafts('accept', form.dataset.id || '');
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

function saveItemEdit(form) {
  const it = state.data.items.find(i => i.id === form.dataset.id);
  if (!it) return;
  const f = new FormData(form);
  form.reset();
  M.clearDrafts('edit-item', form.dataset.id || '');
  const edited = M.applyItemEdit(it, {
    title: f.get('title'), date: f.get('date') || '', time: f.get('time') || '',
    type: f.get('type'), where: f.get('where')
  }, nowIso());
  state.ui.editing = null;
  saveRows('Items', [edited]);
}

function updateWkFade(el) { el.classList.toggle('at-end', el.scrollLeft + el.clientWidth >= el.scrollWidth - 4); }

const AREAS = new Set(['school', 'life', 'projects']);
function currentArea() { const r = (location.hash.replace(/^#\/?/, '') || '').split('?')[0]; return AREAS.has(r) ? r : ''; }

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
  if (act === 'open-palette') openPalette(el.dataset.area || currentArea());
  if (act === 'close-palette') closePalette();
  if (act === 'send-capture') sendCapture();
  if (act === 'file-capture') fileCapture();
  if (act === 'toggle-item') toggleItem(id);
  if (act === 'toggle-step') toggleStep(id);
  if (act === 'add-step') addStep(id);
  if (act === 'toggle-card') { state.ui.open[id] = !state.ui.open[id]; el.closest('.card').classList.toggle('open'); el.setAttribute('aria-expanded', String(!!state.ui.open[id])); }
  if (act === 'toggle-cap-expand') { capExpanded = !capExpanded; previewCapture(); }
  if (act === 'dismiss') {
    const row = state.data.inbox.find(r => r.id === id);
    if (row) {
      saveRows('Inbox', [M.dismissCapture(row)]);
      toastUndo = () => {
        const fresh = state.data.inbox.find(r => r.id === id);
        if (fresh) saveRows('Inbox', [M.undismissCapture(fresh)]);
      };
      showToast('<span>Dismissed</span><button class="toast-btn" data-act="undo-toast">undo</button><button class="toast-btn" data-act="dismiss-toast" aria-label="Dismiss">\u2715</button>');
    }
  }
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
  if (act === 'undo-toast') undoToast();
  if (act === 'dismiss-toast') hideToast();
  if (act === 'edit-item') { state.ui.editing = state.ui.editing === id ? null : id; render(); }
  if (act === 'scratch-prev') {
    state.ui.scratchDate = M.addDays(state.ui.scratchDate || M.todayIso(), -1);
    redrawScratch();
  }
  if (act === 'scratch-next') {
    const today = M.todayIso();
    const next = M.addDays(state.ui.scratchDate || today, 1);
    if (next <= today) { state.ui.scratchDate = next; redrawScratch(); }
  }
  if (act === 'scratch-goto-today') { state.ui.scratchDate = M.todayIso(); redrawScratch(); }
  if (act === 'scratch-check') {
    const row = state.data.scratch.find(r => r.id === id);
    if (row) saveScratchRowQuiet({ ...row, done: !row.done, updated: nowIso() });
    redrawScratch();
  }
  if (act === 'scratch-carry') {
    const today = M.todayIso();
    const row = state.data.scratch.find(r => r.id === id);
    if (row) {
      const [oldRow, newRow] = M.carryToToday(row, today, nowIso());
      saveScratchRowQuiet(oldRow);
      saveScratchRowQuiet(newRow);
      state.ui.scratchDate = today;
      redrawScratch();
    }
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.dataset.form === 'accept') { e.preventDefault(); acceptInbox(form); }
  if (form.dataset.form === 'edit-item') { e.preventDefault(); saveItemEdit(form); }
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(currentArea()); }
  if (e.key === 'Escape' && state.ui.editing) { M.clearDrafts('edit-item', state.ui.editing); state.ui.editing = null; render(); return; }
  if (e.key === 'Escape' && !$('#palette').hidden) closePalette();
  if (e.target.id === 'capture' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); capGuess ? fileCapture() : sendCapture(); }
  if (e.target.closest && e.target.closest('.cap-grid') && e.key === 'Enter') { e.preventDefault(); fileCapture(); return; }
  if (e.target.closest && e.target.closest('[data-form="edit-item"]') && e.key === 'Enter') { e.preventDefault(); saveItemEdit(e.target.closest('[data-form="edit-item"]')); return; }
  if (e.target.dataset && e.target.dataset.stepInput && e.key === 'Enter') { e.preventDefault(); addStep(e.target.dataset.stepInput); }
  if (e.target.dataset && e.target.dataset.scratchInput !== undefined) {
    if (e.key === 'Enter') { e.preventDefault(); scratchEnter(e.target); }
    if (e.key === 'Backspace' && !e.target.value) { e.preventDefault(); scratchDeleteBullet(e.target); }
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'capture') previewCapture();
  if (e.target.name && e.target.name.startsWith('cap-')) {
    const field = e.target.name.slice(4);
    capOverrides[field] = e.target.value;
  }
  if (e.target.dataset && e.target.dataset.scratchInput !== undefined) {
    const id = e.target.dataset.id;
    if (id !== '__new') scheduleScratchSave(id, e.target.value.trim());
  }
});
document.addEventListener('change', (e) => {
  if (e.target.name && e.target.name.startsWith('cap-')) {
    const field = e.target.name.slice(4);
    capOverrides[field] = e.target.value;
    if (field === 'where') {
      const btn = document.querySelector('[data-act="file-capture"]');
      if (btn) {
        const [a, g] = (e.target.value || '').split('/');
        const name = g ? groupName(state.data.context, g) : '';
        btn.textContent = a ? `add to ${name} \u21b5` : 'choose where \u21b5';
        btn.disabled = !a;
      }
    }
  }
});
document.addEventListener('beforeinput', (e) => {
  if (e.target.dataset && e.target.dataset.scratchInput !== undefined) {
    if (e.inputType && e.inputType.startsWith('delete')) {
      if (!scratchDeleting) {
        const t = e.target.value.trim();
        if (t) scratchLastText = { id: e.target.dataset.id, text: t };
        scratchDeleting = true;
      }
    } else {
      scratchDeleting = false;
    }
  }
});
document.addEventListener('focusin', (e) => {
  if (e.target.dataset && e.target.dataset.scratchInput !== undefined) {
    state.ui.scratchFocus = { id: e.target.dataset.id };
    scratchDeleting = false;
    const t = e.target.value.trim();
    if (t) scratchLastText = { id: e.target.dataset.id, text: t };
  }
});
document.addEventListener('focusout', (e) => {
  if (e.target.dataset && e.target.dataset.scratchInput !== undefined) {
    if (!e.target.isConnected) return; // removed from DOM by redrawScratch — skip
    const id = e.target.dataset.id;
    const text = e.target.value.trim();
    if (id === '__new') { if (text) setTimeout(() => scratchCreateFirst(text), 0); }
    else flushScratchSave(id, text);
    setTimeout(() => {
      if (!document.activeElement || document.activeElement.dataset.scratchInput === undefined) {
        state.ui.scratchFocus = null;
      }
    }, 0);
  }
});

document.addEventListener('scroll', (e) => { if (e.target.classList && e.target.classList.contains('wk')) updateWkFade(e.target); }, { capture: true, passive: true });
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
window.addEventListener('online', () => { flush(); refresh(); });
window.addEventListener('offline', () => { state.sync = 'offline'; renderStatus(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { flush(); refresh(); } });
setInterval(() => { if (state.queue.ops.length) flush(); }, 30000);
setInterval(render, 60000);

render();
refresh().then(flush);
