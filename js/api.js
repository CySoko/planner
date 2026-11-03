// Talks to the Apps Script web app. POST bodies are text/plain JSON so the browser sends them
// without a CORS preflight, which Apps Script cannot answer.
import { EXEC_URL } from './config.js';

const CACHE_KEY = 'sokogen-cache-v1';

// The device's local time with its own offset, e.g. 2026-11-02T20:15:00-07:00.
export function localIso(d = new Date()) {
  const p = n => String(Math.abs(n)).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
    'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) +
    (off >= 0 ? '+' : '-') + p(Math.trunc(off / 60)) + ':' + p(off % 60);
}

async function call(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Request failed');
  return json;
}

export function loadAll() { return call(EXEC_URL + '?action=all'); }

function post(body) {
  return call(EXEC_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
}

export function capture(text, now = localIso()) { return post({ action: 'capture', text, source: 'page', now }); }
export function upsert(tab, rows) { return post({ action: 'upsert', tab, rows }); }

// Sends one queued op. Used by queue.flush.
export function sendOp(op) {
  if (op.kind === 'capture') return capture(op.payload.text, op.payload.now);
  if (op.kind === 'upsert') return upsert(op.payload.tab, op.payload.rows);
  return Promise.reject(new Error('Unknown op ' + op.kind));
}

export function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; }
}
export function saveCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}
