import { esc, AREAS, AREA_LABEL, allGroups, groupName, shortDate, wherePicker } from './ui.js';
import { isOpen } from '../model.js';

const parse = s => { try { return JSON.parse(s || '{}') || {}; } catch (e) { return {}; } };

export function renderInbox(state) {
  const { inbox, context, items } = state.data;
  const rows = inbox.filter(r => r.status === 'new').sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)));
  const offer = state.ui.offer;
  const openItems = items.filter(isOpen);

  return `<div>
    <div class="page-head">
      <div><h1 class="page-title" style="color:var(--text)">Inbox</h1>
      <div class="muted"><b style="color:var(--text)">${rows.length} to sort</b> · nothing is filed until you accept it</div></div>
    </div>
    ${offer ? `<div class="panel offer"><span>Add <b>“${esc(offer.word)}”</b> as a keyword for <b>${esc(groupName(context, offer.group))}</b>? Next time it sorts itself.</span>
      <span class="row-end"><button class="btn small" data-act="offer-no">no</button><button class="btn small primary" data-act="offer-yes">add keyword</button></span></div>` : ''}
    ${rows.length ? rows.map(r => card(r, context, openItems)).join('') : '<p class="empty">Inbox zero. Everything is filed.</p>'}
  </div>`;
}

function card(r, context, openItems) {
  const pending = String(r.id).startsWith('pending_');
  const sug = parse(r.suggestion);
  const head = `<div class="inbox-text">${esc(r.text.length > 400 ? r.text.slice(0, 400) + '…' : r.text)}</div>
    <div class="inbox-src">${esc(r.source)} · ${esc(String(r.capturedAt).slice(0, 16).replace('T', ' '))}${pending ? ' · syncing…' : ''}</div>`;

  if (Array.isArray(sug.items) && sug.items.length) {
    return `<article class="panel inbox-card">${head}
      <div class="suggest"><div class="mono muted" style="font-size:12px">Claude sorted this into ${sug.items.length} item${sug.items.length > 1 ? 's' : ''}:</div>
      ${sug.items.map(s => `<div class="row-title" style="margin-top:8px">${esc(s.title)}</div>
        <div class="row-meta"><span class="tag area-${esc(s.area)}">${esc(s.area)}</span> · ${esc(groupName(context, s.group))} · ${esc(s.type || 'deadline')}${s.date ? ' · ' + shortDate(s.date) : ''}${s.time ? ' ' + esc(s.time) : ''}${(s.steps || []).length ? ' · ' + s.steps.length + ' steps' : ''}</div>`).join('')}
      ${sug.notes ? `<div class="muted" style="margin-top:8px">${esc(sug.notes)}</div>` : ''}</div>
      <div class="row-end"><button class="btn" data-act="dismiss" data-id="${esc(r.id)}">dismiss</button>
      <button class="btn primary" data-act="accept-suggestion" data-id="${esc(r.id)}" ${pending ? 'disabled' : ''}>accept all</button></div>
    </article>`;
  }

  const conf = parse(r.confidence), alt = parse(r.alternatives);
  const where = r.guessArea ? r.guessArea + '/' + (r.guessGroup || '') : '';
  const cls = k => (conf[k] === 'unsure' ? 'unsure' : '');
  return `<form class="panel inbox-card" data-form="accept" data-id="${esc(r.id)}">${head}
    <div class="form" style="padding:0;margin:0">
      <label class="wide">Title<input type="text" name="title" value="${esc(r.guessTitle || r.text)}" required></label>
      <div class="${cls('where')}">Where${wherePicker('where', context, where)}${alt.where ? `<button type="button" class="alt" data-act="use-alt" data-field="where" data-value="${esc(alt.where)}">or ${esc(groupName(context, alt.where.split('/')[1]))}?</button>` : ''}</div>
      <label class="${cls('when')}">Date<input type="date" name="date" value="${esc(r.guessDate)}">${alt.when ? `<button type="button" class="alt" data-act="use-alt" data-field="date" data-value="${esc(alt.when)}">or ${shortDate(alt.when)}?</button>` : ''}</label>
      <label>Time<input type="time" name="time" value="${esc(r.guessTime)}"></label>
      <label class="${cls('type')}">Type<select name="type">${['deadline', 'event', 'do-date'].map(t => `<option ${t === (r.guessType || 'deadline') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="wide">Add as a step under<select name="parentId"><option value="">— a new big item —</option>
        ${openItems.map(i => `<option value="${esc(i.id)}" ${i.id === r.guessParent ? 'selected' : ''}>${esc(i.title)}</option>`).join('')}</select></label>
    </div>
    <p class="error" data-error hidden></p>
    <div class="row-end"><button type="button" class="btn" data-act="dismiss" data-id="${esc(r.id)}">dismiss</button>
      <button type="submit" class="btn primary" ${pending ? 'disabled' : ''}>accept ↵</button></div>
  </form>`;
}
