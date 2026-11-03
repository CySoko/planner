import { groupByDay, areaSummary, quoteForDate, isStalled } from '../model.js';
import { esc, AREAS, AREA_LABEL, groupName, groupsFor, shortDate, timeLabel, check } from './ui.js';

export function renderLanding(state, today, nowIso) {
  const { items, steps, quotes, context, inbox } = state.data;
  const q = quoteForDate(today, quotes);
  const days = groupByDay(items, steps, today, 7);
  const weekItems = days.flatMap(d => d.items);
  const newInbox = inbox.filter(r => r.status === 'new').length;
  const stalled = groupsFor(context, 'projects').filter(g => isStalled(g.key, items, steps, nowIso)).length;

  const dayHtml = days.map(d => `
    <div class="day">
      <div class="dayblock ${d.today ? 'today' : ''}"><span class="wd">${d.weekday}</span><span class="num">${d.num}</span></div>
      <div class="day-items">${d.items.length ? d.items.map(it => row(it, context)).join('') : `<div class="empty-day">${d.today ? 'Nothing due today.' : '—'}</div>`}</div>
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
        <div class="quote">${q ? `<q>${esc(q.text)}</q>` : '<span class="muted">Add quotes in the Quotes tab.</span>'}</div>
      </section>

      <section class="panel" aria-labelledby="week-h">
        <div class="panel-head">
          <div><h2 id="week-h">This week</h2><div class="muted">Due or happening <b style="color:var(--date)">${shortDate(days[0].date)} → ${shortDate(days[6].date)}</b></div></div>
          <span class="count">${weekItems.length}</span>
        </div>
        <div class="week">${dayHtml}</div>
      </section>
    </div>

    <aside class="col-side">
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

function row(it, context) {
  const t = timeLabel(it);
  const box = it.occurrence ? '<span></span>' : check(it.status === 'done', 'toggle-item', it.id, it.title, it.area);
  return `<div class="row area-${esc(it.area)}">
    ${box}
    <div><div class="row-title">${esc(it.title)}</div>
    <div class="row-meta"><span class="tag">${esc(it.area)}</span> · ${esc(groupName(context, it.group))} · ${esc(it.occurrence ? 'weekly' : it.type)}</div></div>
    ${t ? `<span class="time ${t.cls}">${esc(t.text)}</span>` : '<span></span>'}
  </div>`;
}
