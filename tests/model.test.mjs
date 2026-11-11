import test from 'node:test';
import assert from 'node:assert/strict';
import { todayIso, addDays, quoteForDate, groupByDay, areaSummary, countdown, expandRepeats, isStalled, nextAction, applyItemEdit, resolveCapture } from '../js/model.js';

const quotes = [{ text: 'A', active: true }, { text: 'B', active: true }, { text: 'C', active: false }];
const item = (o) => ({ id: 'i', area: 'school', group: 'neuro', title: 'T', date: '', time: '', type: 'deadline', repeat: 'none', status: 'open', created: '2026-10-01T00:00:00-07:00', updated: '', ...o });
const step = (o) => ({ id: 's', itemId: 'i', text: 'x', done: false, order: 1, updated: '', ...o });

test('todayIso uses the device local date', () => {
  process.env.TZ = 'America/Denver';
  assert.equal(todayIso(new Date('2026-11-03T03:00:00Z')), '2026-11-02');
});

test('quoteForDate: same quote all day, next one tomorrow, inactive skipped', () => {
  const a = quoteForDate('2026-11-02', quotes), b = quoteForDate('2026-11-02', quotes), c = quoteForDate('2026-11-03', quotes);
  assert.equal(a.text, b.text);
  assert.notEqual(a.text, c.text);
  assert.ok(['A', 'B'].includes(a.text) && ['A', 'B'].includes(c.text));
  assert.equal(quoteForDate('2026-11-02', []), null);
});

test('groupByDay: 7 days starting today, empty week still has 7 days', () => {
  const days = groupByDay([], [], '2026-11-02');
  assert.equal(days.length, 7);
  assert.deepEqual(days.map(d => d.weekday), ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
  assert.equal(days[0].today, true);
  assert.equal(days[0].num, '02');
});

test('groupByDay: places open items on their day sorted by time, done items after open ones, skips out-of-range', () => {
  const items = [
    item({ id: 'a', date: '2026-11-05', time: '14:00' }), item({ id: 'b', date: '2026-11-05', time: '09:30' }),
    item({ id: 'c', date: '2026-11-05', status: 'done' }), item({ id: 'd', date: '2026-11-20' })
  ];
  const thu = groupByDay(items, [], '2026-11-02')[3];
  assert.deepEqual(thu.items.map(i => i.id), ['b', 'a', 'c']);
});

test('groupByDay: done item dated before today does not appear', () => {
  const items = [item({ id: 'old-done', date: '2026-10-30', status: 'done' })];
  const days = groupByDay(items, [], '2026-11-02');
  const allIds = days.flatMap(d => d.items.map(i => i.id));
  assert.ok(!allIds.includes('old-done'));
});

test('groupByDay: done overdue item is not moved to today', () => {
  const items = [item({ id: 'done-late', date: '2026-10-30', status: 'done' })];
  const today = groupByDay(items, [], '2026-11-02')[0];
  assert.ok(!today.items.some(i => i.id === 'done-late'));
});

test('groupByDay: archived items still do not appear', () => {
  const items = [item({ id: 'arc', date: '2026-11-05', status: 'archived' })];
  const days = groupByDay(items, [], '2026-11-02');
  const allIds = days.flatMap(d => d.items.map(i => i.id));
  assert.ok(!allIds.includes('arc'));
});

test('groupByDay: overdue open items show on today, flagged', () => {
  const today = groupByDay([item({ id: 'late', date: '2026-10-30' })], [], '2026-11-02')[0];
  assert.equal(today.items[0].id, 'late');
  assert.equal(today.items[0].overdue, true);
});

test('groupByDay: weekly repeats appear on each matching day', () => {
  const days = groupByDay([item({ id: 'shift', area: 'life', date: '2026-10-31', repeat: 'weekly', type: 'event' })], [], '2026-11-02');
  assert.deepEqual(days[5].items.map(i => i.id), ['shift']);
  assert.equal(days[5].date, '2026-11-07');
});

test('groupByDay today: items sorted school -> projects -> life', () => {
  const items = [
    item({ id: 'l1', area: 'life', date: '2026-11-02', created: '2026-10-01T00:00:00-07:00' }),
    item({ id: 's1', area: 'school', date: '2026-11-02', created: '2026-10-02T00:00:00-07:00' }),
    item({ id: 'p1', area: 'projects', date: '2026-11-02', created: '2026-10-03T00:00:00-07:00' }),
  ];
  const today = groupByDay(items, [], '2026-11-02')[0];
  assert.deepEqual(today.items.map(i => i.id), ['s1', 'p1', 'l1']);
});

test('groupByDay today: within area, timed items before untimed, sorted by time', () => {
  const items = [
    item({ id: 's_notime', area: 'school', date: '2026-11-02', time: '', created: '2026-10-01T00:00:00-07:00' }),
    item({ id: 's_14', area: 'school', date: '2026-11-02', time: '14:00', created: '2026-10-01T00:00:00-07:00' }),
    item({ id: 's_09', area: 'school', date: '2026-11-02', time: '09:00', created: '2026-10-03T00:00:00-07:00' }),
  ];
  const today = groupByDay(items, [], '2026-11-02')[0];
  assert.deepEqual(today.items.map(i => i.id), ['s_09', 's_14', 's_notime']);
});

test('groupByDay today: untimed items sorted by created ascending, ties by id', () => {
  const items = [
    item({ id: 'b', area: 'school', date: '2026-11-02', time: '', created: '2026-10-05T00:00:00-07:00' }),
    item({ id: 'a', area: 'school', date: '2026-11-02', time: '', created: '2026-10-01T00:00:00-07:00' }),
  ];
  const today = groupByDay(items, [], '2026-11-02')[0];
  assert.deepEqual(today.items.map(i => i.id), ['a', 'b']);
});

test('groupByDay today: overdue life item does not jump above school items', () => {
  const items = [
    item({ id: 'overdue_life', area: 'life', date: '2026-10-30', created: '2026-09-01T00:00:00-07:00' }),
    item({ id: 'school1', area: 'school', date: '2026-11-02', created: '2026-10-01T00:00:00-07:00' }),
  ];
  const today = groupByDay(items, [], '2026-11-02')[0];
  assert.deepEqual(today.items.map(i => i.id), ['school1', 'overdue_life']);
});

test('groupByDay today: done items come last, still in area/time/created order', () => {
  const items = [
    item({ id: 'done_s', area: 'school', date: '2026-11-02', status: 'done', created: '2026-10-01T00:00:00-07:00' }),
    item({ id: 'open_l', area: 'life', date: '2026-11-02', created: '2026-10-01T00:00:00-07:00' }),
    item({ id: 'done_l', area: 'life', date: '2026-11-02', status: 'done', time: '10:00', created: '2026-10-01T00:00:00-07:00' }),
  ];
  const today = groupByDay(items, [], '2026-11-02')[0];
  assert.deepEqual(today.items.map(i => i.id), ['open_l', 'done_s', 'done_l']);
});

test('groupByDay non-today: still sorts overdue first then by time', () => {
  const items = [
    item({ id: 'a', area: 'life', date: '2026-11-05', time: '14:00' }),
    item({ id: 'b', area: 'school', date: '2026-11-05', time: '09:30' }),
  ];
  const thu = groupByDay(items, [], '2026-11-02')[3];
  assert.deepEqual(thu.items.map(i => i.id), ['b', 'a']);
});

test('areaSummary: open count excludes done, next is the earliest dated open item, pct from steps', () => {
  const items = [item({ id: 'a', date: '2026-11-05', title: 'Emergence' }), item({ id: 'b', date: '2026-11-13' }), item({ id: 'c', status: 'done' }), item({ id: 'l', area: 'life' })];
  const steps = [step({ itemId: 'a', done: true }), step({ itemId: 'a' }), step({ itemId: 'b', done: true }), step({ itemId: 'c', done: false })];
  const s = areaSummary(items, steps, 'school', '2026-11-02');
  assert.equal(s.open, 2);
  assert.deepEqual(s.next, { date: '2026-11-05', title: 'Emergence' });
  assert.equal(s.pct, 67);
  assert.equal(areaSummary([], [], 'life', '2026-11-02').pct, 0);
});

test('countdown wording', () => {
  assert.equal(countdown('2026-11-02', '2026-11-02'), 'today');
  assert.equal(countdown('2026-11-03', '2026-11-02'), 'tomorrow');
  assert.equal(countdown('2026-11-05', '2026-11-02'), 'in 3d');
  assert.equal(countdown('2026-10-31', '2026-11-02'), '2d overdue');
  assert.equal(countdown('', '2026-11-02'), 'no date');
});

test('expandRepeats: a weekly Saturday shift shows twice in 14 days', () => {
  const occ = expandRepeats([item({ id: 'shift', date: '2026-10-31', repeat: 'weekly' })], '2026-11-02', 14);
  assert.deepEqual(occ.map(o => o.date), ['2026-11-07', '2026-11-14']);
});

test('isStalled: true after 8 idle days, false after 6, uses the latest checked step', () => {
  const items = [item({ id: 'p', area: 'projects', group: 'emoto', created: '2026-10-01T00:00:00-07:00' })];
  const steps = [step({ itemId: 'p', done: true, updated: '2026-10-25T12:00:00-07:00' })];
  assert.equal(isStalled('emoto', items, steps, '2026-11-02T12:00:00-07:00'), true);
  assert.equal(isStalled('emoto', items, steps, '2026-10-31T12:00:00-07:00'), false);
});

test('isStalled: with no checked steps, counts from when the item was created', () => {
  const items = [item({ id: 'p', area: 'projects', group: 'plx', created: '2026-10-30T00:00:00-07:00' })];
  assert.equal(isStalled('plx', items, [], '2026-11-02T00:00:00-07:00'), false);
});

test('nextAction: first unchecked step of the earliest-dated open item, skipping checked ones', () => {
  const items = [item({ id: 'late', area: 'projects', group: 'plx', date: '2026-12-01' }), item({ id: 'soon', area: 'projects', group: 'plx', date: '2026-11-10' })];
  const steps = [step({ id: '1', itemId: 'soon', order: 1, done: true, text: 'Measure' }), step({ id: '2', itemId: 'soon', order: 2, text: 'Order chainring' }), step({ id: '3', itemId: 'late', order: 1, text: 'Later' })];
  assert.equal(nextAction('plx', items, steps).text, 'Order chainring');
  assert.equal(nextAction('nothing', items, steps), null);
});

test('addDays crosses month ends', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
});

import { acceptCapture, acceptSuggestion, dismissCapture, undismissCapture, buildSyntheticInboxRow } from '../js/model.js';

const NOW = '2026-11-02T20:15:00-07:00';
const inbox = {
  id: 'in_1', text: 'goldn deck for nvc', source: 'page', capturedAt: NOW, status: 'new', suggestion: '',
  guessArea: 'school', guessGroup: 'nvc', guessDate: '2026-11-05', guessType: 'deadline', guessTitle: 'Goldn deck', guessTime: '', guessParent: '',
  confidence: '{"where":"sure","when":"sure","type":"sure"}', alternatives: '{}'
};
const asGuessed = { area: 'school', group: 'nvc', title: 'Goldn deck', date: '2026-11-05', time: '', type: 'deadline', parentId: '', steps: [] };

test('acceptCapture with no edits: one item, zero Log rows, inbox accepted', () => {
  const r = acceptCapture(inbox, asGuessed, NOW);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].title, 'Goldn deck');
  assert.equal(r.items[0].status, 'open');
  assert.equal(r.items[0].created, NOW);
  assert.equal(r.items[0].updated, NOW);
  assert.equal(r.log.length, 0);
  assert.equal(r.inbox.status, 'accepted');
  assert.equal(r.inbox.updated, undefined);
});

test('acceptCapture: changing the group writes one Log row with guessed and chosen', () => {
  const r = acceptCapture(inbox, { ...asGuessed, group: 'neuro' }, NOW);
  assert.deepEqual(r.log, [{ inboxId: 'in_1', field: 'group', guessed: 'nvc', chosen: 'neuro', at: NOW }]);
});

test('acceptCapture with parentId creates steps only, under that item', () => {
  const r = acceptCapture(inbox, { ...asGuessed, parentId: 'it_9', title: 'Rehearse twice', steps: ['Time it'] }, NOW);
  assert.equal(r.items.length, 0);
  assert.deepEqual(r.steps.map(s => [s.itemId, s.text, s.done]), [['it_9', 'Rehearse twice', false], ['it_9', 'Time it', false]]);
});

test('acceptCapture with steps creates the item and its checklist', () => {
  const r = acceptCapture(inbox, { ...asGuessed, steps: ['Draft', 'Review'] }, NOW);
  assert.deepEqual(r.steps.map(s => [s.itemId, s.text]), [[r.items[0].id, 'Draft'], [r.items[0].id, 'Review']]);
  assert.ok(r.steps[0].order < r.steps[1].order);
});

test('acceptSuggestion: a Claude suggestion with 3 items creates 3 Items', () => {
  const sug = [
    { area: 'school', group: 'genai', title: 'Proposal', date: '2026-11-18', time: '', type: 'deadline', steps: ['Pick dataset', 'Email Ryo'] },
    { area: 'life', group: 'housing', title: 'Lease walkthrough', date: '2026-12-28', time: '', type: 'event', steps: [] },
    { area: 'projects', group: 'plx', title: 'Order chainring', date: '', time: '', type: 'do-date', steps: [] }
  ];
  const r = acceptSuggestion({ ...inbox, source: 'claude' }, sug, NOW);
  assert.equal(r.items.length, 3);
  assert.equal(r.steps.length, 2);
  assert.equal(r.inbox.status, 'accepted');
  assert.equal(r.log.length, 0);
});

test('dismissCapture marks the inbox row dismissed and files nothing', () => {
  assert.equal(dismissCapture(inbox).status, 'dismissed');
});

test('undismissCapture restores status to new', () => {
  const dismissed = dismissCapture(inbox);
  assert.equal(dismissed.status, 'dismissed');
  const restored = undismissCapture(dismissed);
  assert.equal(restored.status, 'new');
  assert.equal(restored.id, inbox.id);
  assert.equal(restored.text, inbox.text);
});

test('buildSyntheticInboxRow maps parse guess fields and generates an id', () => {
  const guess = { title: 'Neuro reading', area: 'school', group: 'neuro', date: '2026-11-12', time: '14:00', type: 'deadline', parentId: '', confidence: { where: 'sure', when: 'sure', type: 'sure' }, alternatives: {} };
  const row = buildSyntheticInboxRow('neuro reading due thursday', guess, NOW);
  assert.ok(row.id.startsWith('in_'));
  assert.equal(row.text, 'neuro reading due thursday');
  assert.equal(row.source, 'page');
  assert.equal(row.status, 'new');
  assert.equal(row.guessArea, 'school');
  assert.equal(row.guessGroup, 'neuro');
  assert.equal(row.guessDate, '2026-11-12');
  assert.equal(row.guessTitle, 'Neuro reading');
  assert.equal(row.guessTime, '14:00');
  assert.equal(row.guessType, 'deadline');
  assert.equal(row.capturedAt, NOW);
});

test('buildSyntheticInboxRow handles null guess fields gracefully', () => {
  const guess = { title: 'Buy tape', area: null, group: null, date: null, time: null, type: 'deadline', parentId: null, confidence: {}, alternatives: {} };
  const row = buildSyntheticInboxRow('buy tape', guess, NOW);
  assert.equal(row.guessArea, '');
  assert.equal(row.guessGroup, '');
  assert.equal(row.guessDate, '');
  assert.equal(row.guessTime, '');
  assert.equal(row.guessParent, '');
});

import { scratchForDate, insertAfter, carryToToday, restoreScratchRow } from '../js/model.js';

const TODAY = '2026-11-02';
const sc = (o) => ({ id: 'sc_1', date: TODAY, text: 'foo', done: false, order: 1, updated: NOW, deleted: false, ...o });

test('scratchForDate: only that date\'s non-deleted rows, sorted by order; new day returns []', () => {
  const rows = [
    sc({ id: 'a', order: 2 }),
    sc({ id: 'b', order: 1 }),
    sc({ id: 'c', order: 3, deleted: true }),
    sc({ id: 'd', date: '2026-11-01', order: 1 }),
  ];
  assert.deepEqual(scratchForDate(rows, TODAY).map(r => r.id), ['b', 'a']);
  assert.deepEqual(scratchForDate(rows, '2026-11-03'), []);
});

test('insertAfter: new row order falls between afterId and the next bullet', () => {
  const rows = [sc({ id: 'a', order: 1 }), sc({ id: 'b', order: 3 })];
  const nr = insertAfter(rows, TODAY, 'a', NOW);
  assert.ok(nr.order > 1 && nr.order < 3, `order ${nr.order} not between 1 and 3`);
  assert.equal(nr.date, TODAY);
  assert.equal(nr.text, '');
  assert.equal(nr.done, false);
  assert.equal(nr.deleted, false);
});

test('restoreScratchRow: text restored, deleted false, updated set, id/date/order unchanged', () => {
  const row = sc({ id: 'sc_del', text: 'old', deleted: true, order: 5, updated: '2026-11-02T10:00:00-07:00' });
  const restored = restoreScratchRow(row, 'buy tape', '2026-11-02T12:00:00-07:00');
  assert.equal(restored.text, 'buy tape');
  assert.equal(restored.deleted, false);
  assert.equal(restored.updated, '2026-11-02T12:00:00-07:00');
  assert.equal(restored.id, 'sc_del');
  assert.equal(restored.date, TODAY);
  assert.equal(restored.order, 5);
});

test('carryToToday: returns old row done:true and new today row with same text, done:false', () => {
  const row = sc({ id: 'sc_old', date: '2026-11-01', text: 'buy tape' });
  const [old, newRow] = carryToToday(row, TODAY, NOW);
  assert.equal(old.id, 'sc_old');
  assert.equal(old.done, true);
  assert.equal(old.updated, NOW);
  assert.equal(newRow.date, TODAY);
  assert.equal(newRow.text, 'buy tape');
  assert.equal(newRow.done, false);
  assert.notEqual(newRow.id, 'sc_old');
});

// ---- applyItemEdit ----
test('applyItemEdit applies title, date, time, type, where and sets updated', () => {
  const item = { id: 'it_1', title: 'Old', area: 'school', group: 'neuro', date: '2026-11-10', time: '', type: 'deadline', repeat: 'none', status: 'open', updated: '2026-11-08T10:00:00-07:00' };
  const edited = applyItemEdit(item, { title: 'New title', date: '2026-11-12', time: '14:00', type: 'event', where: 'life/health' }, '2026-11-09T12:00:00-07:00');
  assert.equal(edited.title, 'New title');
  assert.equal(edited.date, '2026-11-12');
  assert.equal(edited.time, '14:00');
  assert.equal(edited.type, 'event');
  assert.equal(edited.area, 'life');
  assert.equal(edited.group, 'health');
  assert.equal(edited.updated, '2026-11-09T12:00:00-07:00');
  assert.equal(edited.id, 'it_1');
});

test('applyItemEdit ignores date change on weekly repeats', () => {
  const item = { id: 'it_2', title: 'Shift', area: 'life', group: 'work', date: '2026-11-07', time: '11:00', type: 'event', repeat: 'weekly', status: 'open', updated: '2026-11-01T10:00:00-07:00' };
  const edited = applyItemEdit(item, { date: '2026-11-14', title: 'New shift' }, '2026-11-09T12:00:00-07:00');
  assert.equal(edited.date, '2026-11-07'); // unchanged
  assert.equal(edited.title, 'New shift');
});

import { collectDrafts, saveDrafts, loadDrafts, clearDrafts, clearAllDrafts, _draftStoreForTest } from '../js/model.js';

test('collectDrafts builds a key map from form field descriptors', () => {
  const inputs = [
    { formType: 'add-item', formKey: 'school', fieldName: 'title', value: 'Half-typed' },
    { formType: 'add-item', formKey: 'school', fieldName: 'date', value: '2026-11-15' },
    { formType: 'edit-item', formKey: 'it_1', fieldName: 'title', value: 'Old title' },
    { formType: 'step', formKey: 'it_1', fieldName: '__v', value: 'my step' },
  ];
  const map = collectDrafts(inputs);
  assert.equal(map['add-item|school|title'], 'Half-typed');
  assert.equal(map['add-item|school|date'], '2026-11-15');
  assert.equal(map['edit-item|it_1|title'], 'Old title');
  assert.equal(map['step|it_1|__v'], 'my step');
});

test('collectDrafts skips entries with empty fieldName', () => {
  const map = collectDrafts([
    { formType: 'add-item', formKey: 'school', fieldName: '', value: 'skip me' },
    { formType: 'add-item', formKey: 'school', fieldName: 'title', value: 'keep me' },
  ]);
  assert.equal(Object.keys(map).length, 1);
  assert.equal(map['add-item|school|title'], 'keep me');
});

test('collectDrafts last write wins when the same key appears twice', () => {
  const map = collectDrafts([
    { formType: 'add-item', formKey: 'school', fieldName: 'title', value: 'first' },
    { formType: 'add-item', formKey: 'school', fieldName: 'title', value: 'second' },
  ]);
  assert.equal(map['add-item|school|title'], 'second');
});

// ---- Persistent draft store ----
test('saveDrafts persists across multiple calls and loadDrafts returns all', () => {
  clearAllDrafts();
  saveDrafts([{ formType: 'add-item', formKey: 'school', fieldName: 'title', value: 'Draft A' }]);
  saveDrafts([{ formType: 'step', formKey: 'it_1', fieldName: '__v', value: 'step text' }]);
  const d = loadDrafts();
  assert.equal(d['add-item|school|title'], 'Draft A');
  assert.equal(d['step|it_1|__v'], 'step text');
});

test('clearDrafts removes only entries matching formType+formKey', () => {
  clearAllDrafts();
  saveDrafts([
    { formType: 'step', formKey: 'it_1', fieldName: '__v', value: 'old step' },
    { formType: 'step', formKey: 'it_2', fieldName: '__v', value: 'keep me' },
    { formType: 'add-item', formKey: 'school', fieldName: 'title', value: 'also keep' },
  ]);
  clearDrafts('step', 'it_1');
  const d = loadDrafts();
  assert.equal(d['step|it_1|__v'], undefined);
  assert.equal(d['step|it_2|__v'], 'keep me');
  assert.equal(d['add-item|school|title'], 'also keep');
});

test('clearAllDrafts empties the store completely', () => {
  saveDrafts([{ formType: 'add-item', formKey: 'life', fieldName: 'title', value: 'gone' }]);
  clearAllDrafts();
  assert.deepEqual(loadDrafts(), {});
});

test('saveDrafts overwrites existing value for the same key', () => {
  clearAllDrafts();
  saveDrafts([{ formType: 'step', formKey: 'it_1', fieldName: '__v', value: 'first' }]);
  saveDrafts([{ formType: 'step', formKey: 'it_1', fieldName: '__v', value: 'second' }]);
  assert.equal(loadDrafts()['step|it_1|__v'], 'second');
});

test('loadDrafts returns a copy, not the live store', () => {
  clearAllDrafts();
  saveDrafts([{ formType: 'add-item', formKey: 'school', fieldName: 'title', value: 'x' }]);
  const d = loadDrafts();
  d['add-item|school|title'] = 'mutated';
  assert.equal(loadDrafts()['add-item|school|title'], 'x');
});

test('applyItemEdit ignores blank title', () => {
  const item = { id: 'it_3', title: 'Keep me', area: 'school', group: 'neuro', date: '', time: '', type: 'deadline', repeat: 'none', status: 'open', updated: '2026-11-01T10:00:00-07:00' };
  const edited = applyItemEdit(item, { title: '   ' }, '2026-11-09T12:00:00-07:00');
  assert.equal(edited.title, 'Keep me');
});

// ---- resolveCapture ----
const groups = [
  { area: 'school', key: 'neuro', name: 'Neuroscience' },
  { area: 'school', key: 'genai', name: 'GenAI' },
  { area: 'life', key: 'health', name: 'Health' },
  { area: 'life', key: 'housing', name: 'Housing' },
  { area: 'projects', key: 'plx', name: 'PLX' },
];

test('resolveCapture: overrides win over everything', () => {
  const guess = { title: 'Guess title', area: 'school', group: 'neuro', date: '2026-11-05', time: '09:00', type: 'event', confidence: { where: 'sure' } };
  const overrides = { where: 'life/health', title: 'Override title', date: '2026-12-01', time: '14:00', type: 'do-date' };
  const r = resolveCapture(guess, overrides, 'school', groups);
  assert.equal(r.where, 'life/health');
  assert.equal(r.title, 'Override title');
  assert.equal(r.date, '2026-12-01');
  assert.equal(r.time, '14:00');
  assert.equal(r.type, 'do-date');
});

test('resolveCapture: a sure where guess beats the preset', () => {
  const guess = { title: 'Reading', area: 'school', group: 'neuro', date: '', time: '', type: 'deadline', confidence: { where: 'sure' } };
  const r = resolveCapture(guess, {}, 'life', groups);
  assert.equal(r.where, 'school/neuro');
});

test('resolveCapture: unsure guess in a different area gives empty where and pendingArea', () => {
  const guess = { title: 'Buy tape', area: 'projects', group: 'plx', date: '', time: '', type: 'deadline', confidence: { where: 'unsure' } };
  const r = resolveCapture(guess, {}, 'life', groups);
  assert.equal(r.where, '');
  assert.equal(r.pendingArea, 'life');
});

test('resolveCapture: no guess at all plus preset gives empty where and pendingArea', () => {
  const guess = { title: 'Random thing', area: '', group: '', date: '', time: '', type: '', confidence: {} };
  const r = resolveCapture(guess, {}, 'school', groups);
  assert.equal(r.where, '');
  assert.equal(r.pendingArea, 'school');
});

test('resolveCapture: unsure guess in the preset area keeps its guessed group', () => {
  const guess = { title: 'Rent', area: 'life', group: 'housing', date: '', time: '', type: 'deadline', confidence: { where: 'unsure' } };
  const r = resolveCapture(guess, {}, 'life', groups);
  assert.equal(r.where, 'life/housing');
});

// ---- Starred pinning to today ----
test('groupByDay: starred undated item appears in today with pinnedFrom empty string', () => {
  const items = [item({ id: 'star1', date: '', starred: true })];
  const days = groupByDay(items, [], '2026-11-02');
  const todayItems = days[0].items;
  assert.equal(todayItems.length, 1);
  assert.equal(todayItems[0].id, 'star1');
  assert.equal(todayItems[0].pinnedFrom, '');
});

test('groupByDay: starred item dated in 3 days appears in today (pinned) and on its own day', () => {
  const items = [item({ id: 'star2', date: '2026-11-05', starred: true })];
  const days = groupByDay(items, [], '2026-11-02');
  const todayIds = days[0].items.map(i => i.id);
  const thuIds = days[3].items.map(i => i.id);
  assert.ok(todayIds.includes('star2'));
  assert.ok(thuIds.includes('star2'));
  assert.equal(days[0].items.find(i => i.id === 'star2').pinnedFrom, '2026-11-05');
  assert.equal(days[3].items.find(i => i.id === 'star2').pinnedFrom, undefined);
});

test('groupByDay: starred item dated after the 7-day window appears only in today', () => {
  const items = [item({ id: 'star3', date: '2026-11-20', starred: true })];
  const days = groupByDay(items, [], '2026-11-02');
  const allIds = days.flatMap(d => d.items.map(i => i.id));
  const todayIds = days[0].items.map(i => i.id);
  assert.ok(todayIds.includes('star3'));
  // should not appear on any other day
  assert.equal(allIds.filter(id => id === 'star3').length, 1);
});

test('groupByDay: starred open items sort above unstarred in today', () => {
  const items = [
    item({ id: 'unstarred', area: 'school', date: '2026-11-02', starred: false, created: '2026-10-01T00:00:00-07:00' }),
    item({ id: 'starred', area: 'life', date: '2026-11-02', starred: true, created: '2026-10-01T00:00:00-07:00' }),
  ];
  const todayItems = groupByDay(items, [], '2026-11-02')[0].items;
  assert.deepEqual(todayItems.map(i => i.id), ['starred', 'unstarred']);
});

test('groupByDay: done starred item is not pinned to today', () => {
  const items = [item({ id: 'done_star', date: '2026-11-05', starred: true, status: 'done' })];
  const days = groupByDay(items, [], '2026-11-02');
  const todayIds = days[0].items.map(i => i.id);
  assert.ok(!todayIds.includes('done_star'));
});

test('groupByDay: starred overdue item appears in today once, not duplicated', () => {
  const items = [item({ id: 'overdue_star', date: '2026-10-30', starred: true })];
  const days = groupByDay(items, [], '2026-11-02');
  const todayIds = days[0].items.map(i => i.id);
  assert.equal(todayIds.filter(id => id === 'overdue_star').length, 1);
  assert.equal(days[0].items[0].overdue, true);
});

test('resolveCapture: no preset and no guess gives empty where', () => {
  const guess = { title: 'Random', area: '', group: '', date: '', time: '', type: '', confidence: {} };
  const r = resolveCapture(guess, {}, '', groups);
  assert.equal(r.where, '');
  assert.equal(r.type, 'deadline');
});
