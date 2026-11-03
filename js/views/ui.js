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

export function check(on, act, id, label, area) {
  return `<button class="chk area-${esc(area)} ${on ? 'on' : ''}" data-act="${act}" data-id="${esc(id)}" aria-label="${esc((on ? 'Mark not done: ' : 'Mark done: ') + label)}">${on ? '✓' : ''}</button>`;
}
