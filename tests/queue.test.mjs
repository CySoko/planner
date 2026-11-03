import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyQueue, enqueue, flush, load, save } from '../js/queue.js';
import { localIso } from '../js/api.js';

const op = (id, kind = 'upsert') => ({ id, kind, payload: { n: id } });

test('enqueue adds with attempts 0 and is idempotent by op id', () => {
  let q = enqueue(emptyQueue(), op('a'));
  q = enqueue(q, op('a'));
  assert.equal(q.ops.length, 1);
  assert.equal(q.ops[0].attempts, 0);
});

test('flush sends in order', async () => {
  const seen = [];
  let q = enqueue(enqueue(enqueue(emptyQueue(), op('a')), op('b')), op('c'));
  const r = await flush(q, async (o) => { seen.push(o.id); });
  assert.deepEqual(seen, ['a', 'b', 'c']);
  assert.equal(r.sent, 3);
  assert.deepEqual(r.state.ops, []);
});

test('a failed op stays queued, attempts increments, later ops still send', async () => {
  let q = enqueue(enqueue(emptyQueue(), op('a')), op('b'));
  const r = await flush(q, async (o) => { if (o.id === 'a') throw new Error('offline'); });
  assert.equal(r.sent, 1);
  assert.equal(r.failed, 1);
  assert.deepEqual(r.state.ops.map(o => [o.id, o.attempts]), [['a', 1]]);
});

test('save and load round-trip through a storage object', () => {
  const store = new Map();
  const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  save(enqueue(emptyQueue(), op('a')), storage);
  assert.deepEqual(load(storage).ops.map(o => o.id), ['a']);
});

test('load survives broken or missing storage', () => {
  assert.deepEqual(load({ getItem: () => '{not json' }), emptyQueue());
  assert.deepEqual(load({ getItem: () => { throw new Error('blocked'); } }), emptyQueue());
});

test('localIso writes the device time with its own offset', () => {
  process.env.TZ = 'America/Denver';
  assert.equal(localIso(new Date('2026-11-03T03:15:00Z')), '2026-11-02T20:15:00-07:00');
  process.env.TZ = 'Europe/Prague';
  assert.equal(localIso(new Date('2026-11-03T03:15:00Z')), '2026-11-03T04:15:00+01:00');
  process.env.TZ = 'UTC';
  assert.equal(localIso(new Date('2026-11-03T03:15:00Z')), '2026-11-03T03:15:00+00:00');
});
