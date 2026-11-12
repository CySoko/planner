// Parse.gs — the rules parser. Turns one spoken or typed capture into guesses.
// Every date is computed from nowIso's OWN local date (the capturing device's time zone),
// never from the server clock.

const WEEKDAY_NAMES_ = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_ABBR_ = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
const MONTH_ABBR_ = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const NUMBER_WORDS_ = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const LEAD_ = '\\b(?:(?:due|by|on|before|this)\\s+)?(?:the\\s+)?';
const WD_ALT_ = '(sunday|monday|tuesday|wednesday|thursday|friday|saturday|thurs|thur|tues|sun|mon|tue|wed|thu|fri|sat)';

function parseCapture(text, context, nowIso, openItems) {
  const today = localDate_(nowIso);
  let src = String(text || '').trim().replace(/[.!?,;:\s]+$/, '').replace(/\s+/g, ' ');
  const result = {
    title: '', area: null, group: null, date: null, time: null, type: 'deadline', parentId: null,
    confidence: { where: 'none', when: 'none', type: 'unsure' }, alternatives: {}
  };

  // 1. "for the X, Y" / "add to X: Y" attaches a step to an existing big item.
  const pm = src.match(/^(?:add to|for the|for)\s+(.+?)\s*[,:]\s*(.+)$/i);
  if (pm) {
    const want = norm_(pm[1]);
    const parent = (openItems || []).find(it => { const t = norm_(it.title); return t === want || t.includes(want) || want.includes(t); });
    if (parent) {
      result.parentId = parent.id; result.area = parent.area; result.group = parent.group;
      result.confidence.where = 'sure';
      src = pm[2];
    }
  }
  const lc = src.toLowerCase();

  // 2. Where: keyword matches. Keyword spans are masked so "mountain SUN" is never read as Sunday.
  let masked = lc;
  let whereKeys = [];
  if (!result.parentId) {
    const keywords = (context || []).filter(r => r.kind === 'keyword' && isActive_(r.active) && r.key);
    const hits = [];
    keywords.forEach(k => {
      const re = new RegExp('(^|[^a-z0-9])(' + escapeRe_(String(k.key).toLowerCase()) + ')(?=[^a-z0-9]|$)');
      const m = lc.match(re);
      if (m) {
        const at = m.index + m[1].length;
        hits.push({ at: at, value: String(k.value), key: m[2] });
        masked = masked.slice(0, at) + ' '.repeat(m[2].length) + masked.slice(at + m[2].length);
      }
    });
    hits.sort((a, b) => a.at - b.at);
    const values = [...new Set(hits.map(h => h.value))];
    if (values.length === 1) whereKeys = hits.map(h => h.key);
    if (values.length) {
      setWhere_(result, values[0]);
      result.confidence.where = values.length === 1 ? 'sure' : 'unsure';
      if (values.length > 1) result.alternatives.where = values[1];
    } else {
      const fuzzy = fuzzyKeyword_(lc, keywords);
      if (fuzzy) { setWhere_(result, fuzzy); result.confidence.where = 'unsure'; }
    }
  }

  // 3. When.
  const spans = [];
  const dow = weekday_(today);
  const tries = [
    [LEAD_ + 'end of (?:the )?month\\b', () => ({ date: lastOfMonth_(today) })],
    [LEAD_ + '(today|tonight)\\b', () => ({ date: today })],
    [LEAD_ + 'tomorrow\\b', () => ({ date: addDays_(today, 1) })],
    [LEAD_ + 'in (\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten) (day|days|week|weeks)\\b', m => {
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS_[m[1]];
      return { date: addDays_(today, m[2].startsWith('week') ? n * 7 : n) };
    }],
    [LEAD_ + 'weekend\\b', () => ({ date: addDays_(today, (6 - dow + 7) % 7) })],
    [LEAD_ + 'next week\\b', () => ({ date: addDays_(today, ((1 - dow + 7) % 7) || 7), unsure: true })],
    [LEAD_ + '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.? (\\d{1,2})(?:st|nd|rd|th)?\\b', m => ({ date: nextMonthDay_(today, MONTH_ABBR_.indexOf(m[1]) + 1, Number(m[2])) })],
    [LEAD_ + '(\\d{1,2})(?:st|nd|rd|th)? (?:of )?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\b', m => ({ date: nextMonthDay_(today, MONTH_ABBR_.indexOf(m[2]) + 1, Number(m[1])) })],
    [LEAD_ + '(\\d{1,2})/(\\d{1,2})\\b', m => ({ date: nextMonthDay_(today, Number(m[1]), Number(m[2])) })],
    [LEAD_ + '(\\d{1,2})(?:st|nd|rd|th)\\b', m => ({ date: nextDayOfMonth_(today, Number(m[1])) })],
    [LEAD_ + 'yesterday\\b', () => ({ date: addDays_(today, -1) })],
    [LEAD_ + 'last ' + WD_ALT_ + '\\b', m => {
      const back = ((dow - weekdayIndex_(m[1]) + 7) % 7) || 7;
      return { date: addDays_(today, -back) };
    }],
    [LEAD_ + '(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten) (day|days|week|weeks) ago\\b', m => {
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS_[m[1]];
      return { date: addDays_(today, -(m[2].startsWith('week') ? n * 7 : n)) };
    }],
    [LEAD_ + 'next ' + WD_ALT_ + '\\b', m => {
      const coming = ((weekdayIndex_(m[1]) - dow + 7) % 7) || 7;
      return { date: addDays_(today, coming + 7), unsure: true, alt: addDays_(today, coming) };
    }],
    [LEAD_ + WD_ALT_ + '\\b', m => {
      const diff = (weekdayIndex_(m[1]) - dow + 7) % 7;
      return diff === 0 ? { date: addDays_(today, 7), unsure: true, alt: today } : { date: addDays_(today, diff) };
    }]
  ];
  for (const [pattern, toDate] of tries) {
    const m = masked.match(new RegExp(pattern));
    if (!m) continue;
    const d = toDate(m);
    if (!d.date) continue;
    result.date = d.date;
    result.confidence.when = d.unsure ? 'unsure' : 'sure';
    if (d.alt) result.alternatives.when = d.alt;
    spans.push([m.index, m.index + m[0].length]);
    break;
  }

  // 4. Time.
  const tm = masked.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/) || masked.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/) || masked.match(/\b(?:at\s+)?(noon)\b/);
  if (tm) {
    let h, min = 0;
    if (tm[1] === 'noon') h = 12;
    else {
      h = Number(tm[1]); min = Number(tm[2] || 0);
      if (tm[3] === 'pm' && h < 12) h += 12;
      if (tm[3] === 'am' && h === 12) h = 0;
      if (!tm[3] && h >= 1 && h <= 7) h += 12;
    }
    if (h < 24 && min < 60) {
      result.time = pad_(h) + ':' + pad_(min);
      spans.push([tm.index, tm.index + tm[0].length]);
    }
  }

  // 5. Type.
  if (/\b(due|by|deadline|submit|turn in)\b/.test(lc)) { result.type = 'deadline'; result.confidence.type = 'sure'; }
  else if (/\b(meeting|call|shift|event|appointment|interview|class|lecture|dinner|lunch)\b/.test(lc) || result.time) { result.type = 'event'; result.confidence.type = 'sure'; }
  else if (/\b(work on|start|begin)\b/.test(lc)) { result.type = 'do-date'; result.confidence.type = 'sure'; }

  // 6. Title: the capture minus the date and time words.
  let title = src;
  spans.sort((a, b) => b[0] - a[0]).forEach(([s, e]) => { title = title.slice(0, s) + ' ' + title.slice(e); });
  title = title.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) title = title.replace(/^(?:due|by|on|at|the)\s+/i, '').replace(/\s+(?:due|by|on|at|the)$/i, '').replace(/^[,\-\s]+|[,\-\s]+$/g, '');
  if (!title) title = src;
  const preStrip = title;
  title = title.replace(/^(?:i need to|i have to|i want to|i got to|i gotta|i should|need to|have to|remember to|don't forget to|remind me to)\s+/i, '');
  title = title.replace(/^do (?:the|my) /i, '');
  if (result.confidence.where === 'sure') {
    for (const wk of whereKeys) {
      title = title.replace(new RegExp('\\s+for (?:the |my )?' + escapeRe_(wk) + '(?: class)?$', 'i'), '');
    }
  }
  if (title.replace(/\s+/g, '').length < 2) title = preStrip;
  result.title = title.charAt(0).toUpperCase() + title.slice(1);
  return result;
}

// ---- helpers ----
function localDate_(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) throw new Error('now must be an ISO date-time with an offset');
  return m[1] + '-' + m[2] + '-' + m[3];
}
function toUtc_(d) { const [y, mo, da] = d.split('-').map(Number); return Date.UTC(y, mo - 1, da); }
function fromUtc_(ms) { const x = new Date(ms); return x.getUTCFullYear() + '-' + pad_(x.getUTCMonth() + 1) + '-' + pad_(x.getUTCDate()); }
function addDays_(d, n) { return fromUtc_(toUtc_(d) + n * 86400000); }
function weekday_(d) { return new Date(toUtc_(d)).getUTCDay(); }
function lastOfMonth_(d) { const [y, m] = d.split('-').map(Number); return fromUtc_(Date.UTC(y, m, 0)); }
function validDate_(y, m, d) { const x = new Date(Date.UTC(y, m - 1, d)); return x.getUTCMonth() === m - 1 && x.getUTCDate() === d; }
function nextMonthDay_(today, month, day) {
  const y = Number(today.slice(0, 4));
  if (month < 1 || month > 12 || !validDate_(y, month, day) && !validDate_(y + 1, month, day)) return null;
  const thisYear = y + '-' + pad_(month) + '-' + pad_(day);
  return (validDate_(y, month, day) && thisYear >= today) ? thisYear : (y + 1) + '-' + pad_(month) + '-' + pad_(day);
}
function nextDayOfMonth_(today, day) {
  let [y, m] = today.split('-').map(Number);
  for (let i = 0; i < 3; i++) {
    const cand = y + '-' + pad_(m) + '-' + pad_(day);
    if (validDate_(y, m, day) && cand >= today) return cand;
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return null;
}
function weekdayIndex_(w) { const i = WEEKDAY_NAMES_.indexOf(w); return i >= 0 ? i : WEEKDAY_ABBR_[w]; }
function pad_(n) { return String(n).padStart(2, '0'); }
function norm_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function escapeRe_(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function isActive_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function setWhere_(result, value) { const [area, group] = value.split('/'); result.area = area || null; result.group = group || null; }

// Siri mishearings: one letter off, or two letters swapped, on words of 4+ letters.
function fuzzyKeyword_(lc, keywords) {
  const tokens = lc.split(/[^a-z0-9]+/).filter(t => t.length >= 4);
  for (const t of tokens) {
    const k = keywords.find(k => { const key = String(k.key).toLowerCase(); return key.length >= 4 && !key.includes(' ') && osa_(t, key) <= 1; });
    if (k) return String(k.value);
  }
  return null;
}
function osa_(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i].concat(Array(b.length).fill(0)));
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

if (typeof module !== 'undefined') module.exports = { parseCapture };
