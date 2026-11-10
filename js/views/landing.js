import { groupByDay, areaSummary, quoteForDate, isStalled, scratchForDate } from '../model.js';
import { esc, AREAS, AREA_LABEL, groupName, groupsFor, shortDate, check } from './ui.js';
import { renderScratch } from './scratch.js';

export function renderLanding(state, today, nowIso) {
  const { items, steps, quotes, context, inbox, scratch } = state.data;
  const scratchDate = state.ui.scratchDate || today;
  const scratchHtml = renderScratch(scratchForDate(scratch || [], scratchDate), scratchDate, today);
  const q = quoteForDate(today, quotes);
  const days = groupByDay(items, steps, today, 7);
  const weekItems = days.flatMap(d => d.items);
  const newInbox = inbox.filter(r => r.status === 'new').length;
  const stalled = groupsFor(context, 'projects').filter(g => isStalled(g.key, items, steps, nowIso)).length;

  const colHtml = days.map(d => `
    <div class="wk-col${d.today ? ' is-today' : ''}">
      <div class="wk-head"><span class="wd">${d.weekday}</span><span class="num">${d.num}</span></div>
      ${d.items.length ? `<div class="wk-items">${d.items.map(it => wkCard(it, context)).join('')}</div>` : `<div class="wk-empty">${d.today ? 'Nothing due today.' : '—'}</div>`}
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
      <div class="scratch-slot">${scratchHtml}</div>
      <section class="panel" aria-labelledby="week-h">
        <div class="panel-head">
          <div><h2 id="week-h">This week</h2><div class="muted">Due or happening <b style="color:var(--date)">${shortDate(days[0].date)} → ${shortDate(days[6].date)}</b> <span class="mono wk-more">· scroll for more →</span></div></div>
          <span class="count">${weekItems.length}</span>
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
        <div class="stat"><div class="n">${weekItems.length}</div><div class="l">this week</div></div>
        <div class="stat"><div class="n" style="color:var(--date)">${weekItems.filter(i => i.type === 'deadline').length}</div><div class="l">deadlines</div></div>
        <div class="stat"><div class="n" style="color:var(--stalled)">${stalled}</div><div class="l">stalled</div></div>
      </section>
    </aside>
  </div>`;
}

function wkLabel(it) {
  if (it.overdue) return { text: 'OVERDUE', cls: 'overdue' };
  if (it.type === 'deadline') return { text: it.time ? 'DUE ' + it.time : 'DUE', cls: 'due' };
  if (it.type === 'event') return { text: it.time || 'ALL DAY', cls: '' };
  return { text: it.time ? 'TO DO \u00b7 ' + it.time : 'TO DO', cls: 'do' };
}

function wkCard(it, context) {
  const done = it.status === 'done';
  const box = it.occurrence ? '<span></span>' : check(done, 'toggle-item', it.id, it.title, it.area);
  const label = wkLabel(it);
  const shortGroup = groupName(context, it.group).split(' \u00b7 ')[0];
  return `<div class="wk-card area-${esc(it.area)}${done ? ' done' : ''}">
    <div class="wk-row">${box}<div class="wk-body">
      <div class="wk-title">${esc(it.title)}</div>
      <div class="wk-meta"><span class="tag">${esc(it.area)}</span> \u00b7 ${esc(shortGroup)}</div>
      <span class="time ${label.cls}">${esc(label.text)}</span>
    </div></div>
  </div>`;
}
