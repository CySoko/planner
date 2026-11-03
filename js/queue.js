// Offline change queue. Every change goes here first, then gets sent.
// A failed op stays queued and is retried; later ops are still attempted.

const KEY = 'sokogen-queue-v1';

export function emptyQueue() { return { ops: [] }; }

export function enqueue(state, op) {
  if (state.ops.some(o => o.id === op.id)) return state;
  return { ops: [...state.ops, { ...op, attempts: 0 }] };
}

export async function flush(state, send) {
  const remaining = [];
  let sent = 0, failed = 0;
  for (const op of state.ops) {
    try { await send(op); sent++; }
    catch (e) { failed++; remaining.push({ ...op, attempts: (op.attempts || 0) + 1 }); }
  }
  return { state: { ops: remaining }, sent, failed };
}

export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && Array.isArray(parsed.ops) ? parsed : emptyQueue();
  } catch (e) { return emptyQueue(); }
}

export function save(state, storage = globalThis.localStorage) {
  try { storage && storage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked: keep in memory */ }
}
