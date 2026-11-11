// Small shared view helpers.
import { weekdayOf } from '../model.js';

export const AREAS = ['school', 'life', 'projects'];
export const AREA_LABEL = { school: 'School', life: 'Life', projects: 'Projects' };
const KIND_AREA = { class: 'school', life: 'life', project: 'projects' };

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const active = r => r.active === true || String(r.active).toUpperCase() === 'TRUE';

// Groups (classes, life areas, projects) for an area, in Context order.
export function groupsFor(context, area) {
  return (context || []).filter(r => active(r) && KIND_AREA[r.kind] === area).map(r => ({ key: String(r.key), name: String(r.value) }));
}
export function allGroups(context) {
  return AREAS.flatMap(a => groupsFor(context, a).map(g => ({ ...g, area: a })));
}
export function groupName(context, group) {
  const g = (context || []).find(r => KIND_AREA[r.kind] && String(r.key) === String(group));
  return g ? String(g.value) : (group || 'unsorted');
}

export function shortDate(iso) { return iso ? weekdayOf(iso) + ' ' + iso.slice(5, 7) + '.' + iso.slice(8) : ''; }

export function timeLabel(item) {
  if (item.overdue) return { text: 'OVERDUE', cls: 'overdue' };
  if (item.type === 'deadline') return { text: item.time ? 'DUE ' + item.time : 'DUE', cls: 'due' };
  if (item.time) return { text: item.time, cls: '' };
  return null;
}

export function editItemForm(it, context) {
  const groups = allGroups(context);
  return `<form class="wk-pop" data-form="edit-item" data-id="${esc(it.id)}">
        <input class="wk-title-input" type="text" name="title" value="${esc(it.title)}" required>
        <textarea class="wk-desc-input" name="notes" rows="2" placeholder="description (optional)">${esc(it.notes || '')}</textarea>
        <div class="wk-edit-more" hidden>
          <label class="wk-f">Date<input type="date" name="date" value="${esc(it.date || '')}" ${it.repeat === 'weekly' ? 'disabled' : ''}></label>
          ${it.repeat === 'weekly' ? '<p class="wk-note">Repeats weekly. Changes apply to every week.</p>' : ''}
          <label class="wk-f">Time<input type="time" name="time" value="${esc(it.time || '')}"></label>
          <label class="wk-f">Type<select name="type">${['deadline', 'event', 'do-date'].map(t => `<option ${t === it.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="wk-f">Where<select name="where">${groups.map(g => `<option value="${esc(g.area + '/' + g.key)}" ${g.area === it.area && g.key === it.group ? 'selected' : ''}>${esc(AREA_LABEL[g.area])} \u00b7 ${esc(g.name)}</option>`).join('')}</select></label>
        </div>
        <div class="wk-edit-foot"><button type="button" class="btn small" data-act="toggle-edit-more">more \u25b8</button><div class="row-end"><button type="button" class="btn small" data-act="edit-item" data-id="${esc(it.id)}">esc</button><button type="submit" class="btn small primary">save \u21b5</button></div></div>
      </form>`;
}

export function check(on, act, id, label, area) {
  return `<button class="chk area-${esc(area)} ${on ? 'on' : ''}" data-act="${act}" data-id="${esc(id)}" aria-label="${esc((on ? 'Mark not done: ' : 'Mark done: ') + label)}">${on ? '✓' : ''}</button>`;
}
