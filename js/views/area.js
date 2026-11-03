import { countdown, daysBetween, isStalled, nextAction } from '../model.js';
import { esc, AREA_LABEL, groupsFor, timeLabel, check } from './ui.js';

const isOpen = i => i.status !== 'done' && i.status !== 'archived';
const byDate = (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '').localeCompare(b.time || '');

export function renderArea(area, state, today, nowIso) {
  const { items, steps, context } = state.data;
  const open = items.filter(i => i.area === area && isOpen(i)).sort(byDate);
  const groups = groupsFor(context, area);
  const known = new Set(groups.map(g => g.key));
  const stepsLeft = steps.filter(s => open.some(i => i.id === s.itemId) && s.done !== true).length;

  let body = '';
  if (area === 'life') {
    const dated = open.filter(i => i.repeat !== 'weekly');
    const weekly = open.filter(i => i.repeat === 'weekly');
    body += section('Deadlines and plans', '', '', dated, state, today);
    if (weekly.length) body += section('Every week', '', '', weekly, state, today);
  } else {
    groups.forEach(g => {
      const its = open.filter(i => i.group === g.key);
      if (!its.length && area === 'school') return;
      let badge = '', below = '';
      if (area === 'projects') {
        const na = nextAction(g.key, items, steps);
        if (isStalled(g.key, items, steps, nowIso)) badge = '<span class="badge stalled">stalled</span>';
        below = `<div class="next-action">${na ? `<b>Next:</b> ${esc(na.text)}` : '<span class="muted">No next action. Add a step so this keeps moving.</span>'}</div>`;
      }
      body += section(g.name, badge, below, its, state, today, area === 'projects');
    });
    const other = open.filter(i => !known.has(i.group));
    if (other.length) body += section('Other', '', '', other, state, today);
  }
  if (!open.length) body += `<p class="empty">Nothing open in ${AREA_LABEL[area]}. Use + add task to start one.</p>`;

  const form = state.ui.adding === area ? addForm(area, groups) : '';
  return `<div class="area-${area}">
    <div class="page-head">
      <div><h1 class="page-title">${AREA_LABEL[area]}</h1>
        <div class="muted"><b style="color:var(--text)">${open.length} big item${open.length === 1 ? '' : 's'}</b> · ${stepsLeft} step${stepsLeft === 1 ? '' : 's'} left</div></div>
      <button class="btn primary" data-act="toggle-add" data-area="${area}">+ add task</button>
    </div>
    ${form}${body}
  </div>`;
}

function section(title, badge, below, its, state, today, keepEmpty) {
  if (!its.length && !keepEmpty) return '';
  return `<section class="group">
    <div class="group-head"><h2>${esc(title)}</h2>${badge}<span class="rule"></span></div>
    ${below}
    ${its.map(i => card(i, state, today)).join('')}
  </section>`;
}

function card(it, state, today) {
  const steps = state.data.steps.filter(s => s.itemId === it.id).sort((a, b) => Number(a.order) - Number(b.order));
  const done = steps.filter(s => s.done === true).length;
  const pct = steps.length ? Math.round(done / steps.length * 100) : 0;
  const isOpenCard = !!state.ui.open[it.id];
  const n = it.date ? daysBetween(today, it.date) : null;
  const cd = countdown(it.date, today);
  const cdCls = n === null ? '' : n < 0 ? 'late' : n <= 3 ? 'soon' : '';
  const t = timeLabel(it);
  const block = it.date
    ? `<div class="dayblock ${n !== null && n >= 0 && n <= 3 ? 'today' : ''}"><span class="wd">${weekday(it.date)}</span><span class="num">${it.date.slice(8)}</span></div>`
    : `<div class="dayblock"><span class="wd">—</span><span class="num">--</span></div>`;
  return `<article class="panel card ${isOpenCard ? 'open' : ''}">
    <button class="card-head" data-act="toggle-card" data-id="${esc(it.id)}" aria-expanded="${isOpenCard}">
      ${block}
      <div class="card-main">
        <div class="card-title-row"><span class="chev" aria-hidden="true">▸</span><span class="card-title">${esc(it.title)}</span>
          <span class="countdown ${cdCls}">${esc(it.repeat === 'weekly' ? 'weekly' : cd)}</span>${t && t.text !== 'DUE' ? `<span class="time ${t.cls}">${esc(t.text)}</span>` : ''}</div>
        <div class="progress"><div class="bar"><span style="width:${pct}%"></span></div><span class="n">${done}/${steps.length}</span></div>
      </div>
    </button>
    <div class="card-body"><div><div class="card-inner">
      ${steps.map(s => `<div class="step ${s.done === true ? 'done' : ''}">${check(s.done === true, 'toggle-step', s.id, s.text, it.area)}<span class="step-text">${esc(s.text)}</span></div>`).join('')}
      <div class="add-row"><input type="text" placeholder="add step…" aria-label="Add a step to ${esc(it.title)}" data-step-input="${esc(it.id)}">
        <button class="btn small" data-act="add-step" data-id="${esc(it.id)}">+ add step</button></div>
      <div class="card-actions"><button class="btn small" data-act="toggle-item" data-id="${esc(it.id)}">Mark done</button></div>
    </div></div></div>
  </article>`;
}

function weekday(iso) { return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(iso + 'T12:00:00Z').getUTCDay()]; }

function addForm(area, groups) {
  return `<form class="panel form" data-form="add-item" data-area="${area}">
    <label class="wide">Title<input type="text" name="title" required placeholder="${area === 'school' ? 'Sound final mix' : area === 'life' ? 'Lease walkthrough' : 'Order chainring'}"></label>
    <label>${area === 'school' ? 'Class' : area === 'life' ? 'Part of life' : 'Project'}<select name="group">${groups.map(g => `<option value="${esc(g.key)}">${esc(g.name)}</option>`).join('')}</select></label>
    <label>Date<input type="date" name="date"></label>
    <label>Time<input type="time" name="time"></label>
    <label>Type<select name="type"><option value="deadline">deadline</option><option value="event">event</option><option value="do-date">do-date</option></select></label>
    ${area === 'life' ? '<label>Repeats<select name="repeat"><option value="none">no</option><option value="weekly">every week</option></select></label>' : ''}
    <div class="row-end wide"><button type="button" class="btn" data-act="toggle-add" data-area="${area}">cancel</button><button class="btn primary" type="submit">create ↵</button></div>
  </form>`;
}

