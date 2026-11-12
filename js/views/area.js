import { countdown, daysBetween, isOpen, isStalled, nextAction, todayIso } from '../model.js';
import { esc, AREAS, AREA_LABEL, groupsFor, timeLabel, check, editItemForm, shortDate } from './ui.js';

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
    const general = open.filter(i => !i.group || !known.has(i.group));
    if (general.length) body += section('General', '', '', general, state, today);
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
  }
  if (!open.length) body += `<p class="empty">Nothing open in ${AREA_LABEL[area]}. Use + add task to start one.</p>`;

  const areaNav = AREAS.map(a =>
    a === area
      ? `<h1 class="page-title" aria-current="page">${AREA_LABEL[a]}</h1>`
      : `<a class="page-alt area-${a}" href="#/${a}">${AREA_LABEL[a]}</a>`
  ).join('');

  return `<div class="area-${area}">
    <div class="page-head">
      <div><nav class="area-nav" aria-label="Areas">${areaNav}</nav>
        <div class="muted"><b style="color:var(--text)">${open.length} big item${open.length === 1 ? '' : 's'}</b> · ${stepsLeft} step${stepsLeft === 1 ? '' : 's'} left</div></div>
    </div>
    ${body}
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
  const editing = state.ui.editing === it.id;
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
        <div class="card-title-row"><span class="chev" aria-hidden="true">▸</span>${it.starred ? '<span class="card-star" aria-hidden="true">\u2605</span>' : ''}<span class="card-title">${esc(it.title)}</span>
          <span class="countdown ${cdCls}">${esc(it.repeat === 'weekly' ? 'weekly' : cd)}</span>${t && t.text !== 'DUE' ? `<span class="time ${t.cls}">${esc(t.text)}</span>` : ''}</div>${it.notes ? `\n        <div class="card-desc">${esc(it.notes)}</div>` : ''}
        <div class="progress"><div class="bar"><span style="width:${pct}%"></span></div><span class="n">${done}/${steps.length}</span></div>
      </div>
    </button>
    <div class="card-body"><div><div class="card-inner">
      ${editing ? editItemForm(it, state.data.context) : ''}
      ${steps.map(s => { const td = todayIso(); const late = s.date && s.date < td && s.done !== true; return `<div class="step ${s.done === true ? 'done' : ''}">${check(s.done === true, 'toggle-step', s.id, s.text, it.area)}<span class="step-text">${esc(s.text)}</span>${s.date ? `<button class="step-date${late ? ' late' : ''}" data-act="clear-step-date" data-id="${esc(s.id)}" title="Remove date" aria-label="Remove date from ${esc(s.text)}">${shortDate(s.date)}</button>` : ''}</div>`; }).join('')}
      <div class="add-row"><input type="text" placeholder="add step…" aria-label="Add a step to ${esc(it.title)}" data-step-input="${esc(it.id)}">
        <button class="btn small" data-act="add-step" data-id="${esc(it.id)}">+ add step</button></div>
      <div class="card-actions"><button class="btn small" data-act="toggle-star" data-id="${esc(it.id)}">${it.starred ? '\u2605 Starred' : '\u2606 Star'}</button>${editing ? '' : `<button class="btn small" data-act="edit-item" data-id="${esc(it.id)}">Edit</button>`}<button class="btn small" data-act="toggle-item" data-id="${esc(it.id)}">Mark done</button></div>
    </div></div></div>
  </article>`;
}

function weekday(iso) { return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(iso + 'T12:00:00Z').getUTCDay()]; }
