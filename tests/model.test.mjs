import test from 'node:test';
import assert from 'node:assert/strict';
import { todayIso, addDays, quoteForDate, groupByDay, areaSummary, countdown, expandRepeats, isStalled, nextAction } from '../js/model.js';

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

test('groupByDay: places open items on their day, sorted by time, skips done and out-of-range', () => {
  const items = [
    item({ id: 'a', date: '2026-11-05', time: '14:00' }), item({ id: 'b', date: '2026-11-05', time: '09:30' }),
    item({ id: 'c', date: '2026-11-05', status: 'done' }), item({ id: 'd', date: '2026-11-20' })
  ];
  const thu = groupByDay(items, [], '2026-11-02')[3];
  assert.deepEqual(thu.items.map(i => i.id), ['b', 'a']);
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

import { acceptCapture, acceptSuggestion, dismissCapture } from '../js/model.js';

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
