import { esc } from './ui.js';
import { weekdayOf } from '../model.js';

export function renderScratch(rows, date, today) {
  const isToday = date === today;
  const isPast = date < today;
  const dateLabel = weekdayOf(date) + ' ' + date.slice(5, 7) + '.' + date.slice(8);
  const bullets = rows.map(r => bulletHtml(r, isPast)).join('') + (!isPast ? emptyBullet() : '');
  const hasDone = rows.some(r => r.done);

  return `<section class="panel scratch-panel" data-date="${esc(date)}">
    <div class="scratch-head">
      <div class="scratch-title">
        <span class="h2 scratch-h">Quick Notes</span>
        <span class="mono scratch-date">${esc(dateLabel)}</span>
      </div>
      <div class="scratch-nav-btns">
        <button class="clear-done mono" data-act="clear-done-scratch" style="${hasDone ? '' : 'visibility:hidden'}">clear done</button>
        <button class="scratch-nav" data-act="scratch-prev" aria-label="Previous day">‹</button>
        <button class="scratch-nav" data-act="scratch-next" aria-label="Next day"${isToday ? ' disabled' : ''}>›</button>
        ${!isToday ? `<button class="btn small scratch-goto" data-act="scratch-goto-today">today</button>` : ''}
      </div>
    </div>
    <ul class="scratch-list">
      ${bullets}
    </ul>
  </section>`;
}

function bulletHtml(r, isPast) {
  const showCarry = isPast && !r.done;
  return `<li class="scratch-item${r.done ? ' done' : ''}" data-id="${esc(r.id)}">
    <button class="chk${r.done ? ' on' : ''}" data-act="scratch-check" data-id="${esc(r.id)}" aria-label="${r.done ? 'Mark not done' : 'Mark done'}">${r.done ? '✓' : ''}</button>
    <input class="scratch-text" type="text" value="${esc(r.text)}" data-id="${esc(r.id)}" data-scratch-input autocomplete="off" spellcheck="false">
    ${showCarry ? `<button class="btn small scratch-carry" data-act="scratch-carry" data-id="${esc(r.id)}">→ today</button>` : '<span></span>'}
  </li>`;
}

function emptyBullet() {
  return `<li class="scratch-item" data-id="__new">
    <button class="chk" disabled aria-hidden="true"></button>
    <input class="scratch-text" type="text" placeholder="type a task…" data-id="__new" data-scratch-input autocomplete="off" spellcheck="false">
    <span></span>
  </li>`;
}
