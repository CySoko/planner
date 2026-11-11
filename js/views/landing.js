import { groupByDay, areaSummary, quoteForDate, isStalled, scratchForDate, weekdayOf } from '../model.js';
import { esc, AREAS, AREA_LABEL, groupName, allGroups, groupsFor, shortDate, check, editItemForm } from './ui.js';
import { renderScratch } from './scratch.js';

export function renderLanding(state, today, nowIso) {
  const { items, steps, quotes, context, inbox, scratch } = state.data;
  const scratchDate = state.ui.scratchDate || today;
  const scratchHtml = renderScratch(scratchForDate(scratch || [], scratchDate), scratchDate, today);
  const q = quoteForDate(today, quotes);
  const days = groupByDay(items, steps, today, 7);
  const weekItems = days.flatMap(d => d.items).filter(i => i.kind !== 'step');
  const seen = new Set();
  const weekOpen = weekItems.filter(i => i.status !== 'done' && !seen.has(i.id) && seen.add(i.id));
  const newInbox = inbox.filter(r => r.status === 'new').length;
  const stalled = groupsFor(context, 'projects').filter(g => isStalled(g.key, items, steps, nowIso)).length;

  const colHtml = days.map(d => `
    <div class="wk-col${d.today ? ' is-today' : ''}">
      <div class="wk-head"><span class="wd">${d.weekday}</span><span class="num">${d.num}</span></div>
      ${d.items.length ? `<div class="wk-items">${d.items.map(it => it.kind === 'step' ? wkStepCard(it) : wkCard(it, context, state.ui.editing)).join('')}</div>` : (d.today ? '<div class="wk-empty">Nothing due today.</div>' : '')}
      <button class="wk-add" data-act="open-palette" data-date="${d.date}">+ add</button>
    </div>`).join('');

  const doors = AREAS.map(a => {
    const s = areaSummary(items, steps, a, today);
    return `<a class="door area-${a}" href="#/${a}">
      <div class="door-top"><span class="door-name">${AREA_LABEL[a]}</span><span class="arrow">→</span></div>
      <div class="door-next">${s.next ? `<span class="door-date">${shortDate(s.next.date)}</span><span>${esc(s.next.title)}</span>` : '<span class="muted">Nothing dated yet</span>'}</div>
      <div class="bar"><span style="width:${s.pct}%"></span></div>
      <div class="door-meta"><span>${s.open} open</span><span>${s.pct}%</span></div>
    </a>`;
  }).join('');

  return `
  <div class="grid">
    <div class="col-main">
      <section class="panel remember" aria-label="Always remember">
        <div class="orb-wrap">
          <div class="orb" aria-hidden="true">
            <span class="core"></span><span class="ring"></span>
            <span class="tick t0"></span><span class="tick t1"></span><span class="tick t2"></span><span class="tick t3"></span>
            <span class="orbit"><span class="dot"></span></span>
          </div>
          <span class="mono breathe-label">breathe</span>
        </div>
        <div class="quote">${q ? esc(q.text) : '<span class="muted">Add quotes in the Quotes tab.</span>'}</div>
      </section>
      <section class="panel" aria-labelledby="week-h">
        <div class="panel-head">
          <div><h2 id="week-h">This week</h2><div class="muted">Due or happening <b style="color:var(--date)">${shortDate(days[0].date)} → ${shortDate(days[6].date)}</b> <span class="mono wk-more">· scroll for more →</span></div></div>
          <span class="count">${weekOpen.length}</span>
        </div>
        <div class="wk">${colHtml}</div>
      </section>
    </div>

    <aside class="col-side">
      ${scratchHtml}
      <section class="panel areas" aria-labelledby="areas-h">
        <a class="inbox-btn" href="#/inbox"><span>Inbox</span><span><b>${newInbox}</b> to sort →</span></a>
        <h2 id="areas-h">Areas</h2>
        ${doors}
      </section>
      <section class="stats">
        <div class="stat"><div class="n">${weekOpen.length}</div><div class="l">this week</div></div>
        <div class="stat"><div class="n" style="color:var(--date)">${weekOpen.filter(i => i.type === 'deadline').length}</div><div class="l">deadlines</div></div>
        <div class="stat"><div class="n" style="color:var(--stalled)">${stalled}</div><div class="l">stalled</div></div>
      </section>
    </aside>
  </div>`;
}

function wkStepCard(s) {
  const done = s.done === true;
  const box = check(done, 'toggle-step', s.id, s.text, s.area);
  const label = s.overdue ? { text: 'OVERDUE', cls: 'overdue' } : null;
  return `<div class="wk-card wk-step area-${esc(s.area)}${done ? ' done' : ''}">
    <div class="wk-row">${box}<div class="wk-body">
      <div class="wk-title">${esc(s.text)}</div>
      <button class="wk-parent" data-act="open-parent" data-id="${esc(s.itemId)}" data-area="${esc(s.area)}">↳ ${esc(s.parentTitle)}</button>
    </div></div>${label ? `\n    <div class="wk-foot"><span class="wk-tools"></span><span class="time ${label.cls}">${esc(label.text)}</span></div>` : ''}
  </div>`;
}

function wkLabel(it) {
  if (it.overdue) return { text: 'OVERDUE', cls: 'overdue' };
  if (it.pinnedFrom !== undefined) {
    if (it.pinnedFrom === '') return { text: '', cls: '' };
    const day = weekdayOf(it.pinnedFrom);
    const sd = shortDate(it.pinnedFrom);
    const isDue = it.type === 'deadline';
    const prefix = isDue ? 'DUE ' : '';
    const timePart = it.time ? ' \u00b7 ' + it.time : '';
    return { text: prefix + day + ' ' + sd + timePart, cls: isDue ? 'due' : '' };
  }
  if (it.type === 'deadline') return { text: it.time ? 'DUE ' + it.time : 'DUE', cls: 'due' };
  if (it.type === 'event') return { text: it.time || 'ALL DAY', cls: '' };
  return { text: it.time ? 'TO DO \u00b7 ' + it.time : 'TO DO', cls: 'do' };
}

function wkCard(it, context, editingId) {
  const done = it.status === 'done';
  const editing = editingId === it.id;
  const label = wkLabel(it);
  const shortGroup = groupName(context, it.group).split(' \u00b7 ')[0];
  if (editing) {
    return `<div class="wk-card area-${esc(it.area)}${done ? ' done' : ''} editing">
      ${editItemForm(it, context)}
    </div>`;
  }
  const box = it.occurrence ? '<span></span>' : check(done, 'toggle-item', it.id, it.title, it.area);
  return `<div class="wk-card area-${esc(it.area)}${done ? ' done' : ''}">
    <div class="wk-row">${box}<div class="wk-body">
      <button type="button" class="wk-title" data-act="edit-item" data-id="${esc(it.id)}" aria-label="Edit ${esc(it.title)}">${esc(it.title)}</button>${it.notes ? `\n      <div class="wk-desc">${esc(it.notes)}</div>` : ''}
      <div class="wk-meta"><span class="tag">${esc(it.area)}</span> \u00b7 ${esc(shortGroup)}</div>
    </div></div>
    <div class="wk-foot"><span class="wk-tools">${it.occurrence ? '' : `<button class="wk-star${it.starred ? ' on' : ''}" data-act="toggle-star" data-id="${esc(it.id)}" aria-pressed="${!!it.starred}" aria-label="Star ${esc(it.title)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="${it.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>`}</span><span class="time ${label.cls}">${esc(label.text)}</span></div>
  </div>`;
}
