// Schema.gs — the single source of truth for the Sheet's columns.
// RULE: never reorder or delete a column. New columns only go at the END of a list.

const HEADERS = {
  Items: ['id', 'area', 'group', 'title', 'date', 'time', 'type', 'repeat', 'status', 'notes', 'created', 'updated'],
  Steps: ['id', 'itemId', 'text', 'done', 'order', 'updated'],
  Inbox: ['id', 'text', 'source', 'capturedAt', 'guessArea', 'guessGroup', 'guessDate', 'guessType', 'confidence', 'suggestion', 'status',
          'guessTitle', 'guessTime', 'guessParent', 'alternatives'],
  Context: ['kind', 'key', 'value', 'active'],
  Quotes: ['text', 'author', 'active'],
  Log: ['inboxId', 'field', 'guessed', 'chosen', 'at'],
  Scratch: ['id', 'date', 'text', 'done', 'order', 'updated', 'deleted']
};

// Context rows: [kind, key, value, active]
//   class / life / project  -> a group (key) and its display name (value)
//   keyword                 -> a word (key) that points at area/group (value)
//   rule                    -> a standing note the nightly sort reads
const DEFAULT_CONTEXT = [
  ['class', 'neuro', 'Neurohacking', true],
  ['class', 'sound', 'Sound · ATLAS 3200', true],
  ['class', 'genai', 'Generative AI · ATLS 4519', true],
  ['class', 'nvc', 'New Venture Creation · ESBM 4830', true],
  ['life', 'housing', 'Housing', true],
  ['life', 'work', 'Mountain Sun', true],
  ['life', 'abroad', 'Study abroad', true],
  ['life', 'gilman', 'Gilman scholarship', true],
  ['project', 'plx', 'Parallax bike build', true],
  ['project', 'sokogen', 'SOKOGEN', true],
  ['project', 'emoto', 'E-moto ID research', true],
  ['keyword', 'neuro', 'school/neuro', true],
  ['keyword', 'neurohacking', 'school/neuro', true],
  ['keyword', 'emergence', 'school/neuro', true],
  ['keyword', 'sound', 'school/sound', true],
  ['keyword', 'ableton', 'school/sound', true],
  ['keyword', '3200', 'school/sound', true],
  ['keyword', 'genai', 'school/genai', true],
  ['keyword', '4519', 'school/genai', true],
  ['keyword', 'ryo', 'school/genai', true],
  ['keyword', 'nvc', 'school/nvc', true],
  ['keyword', 'goldn', 'school/nvc', true],
  ['keyword', 'golden', 'school/nvc', true],
  ['keyword', 'venture', 'school/nvc', true],
  ['keyword', 'lease', 'life/housing', true],
  ['keyword', 'rent', 'life/housing', true],
  ['keyword', 'move out', 'life/housing', true],
  ['keyword', 'shift', 'life/work', true],
  ['keyword', 'mountain sun', 'life/work', true],
  ['keyword', 'abroad', 'life/abroad', true],
  ['keyword', 'ciee', 'life/abroad', true],
  ['keyword', 'visa', 'life/abroad', true],
  ['keyword', 'passport', 'life/abroad', true],
  ['keyword', 'barcelona', 'life/abroad', true],
  ['keyword', 'prague', 'life/abroad', true],
  ['keyword', 'gilman', 'life/gilman', true],
  ['keyword', 'plx', 'projects/plx', true],
  ['keyword', 'parallax', 'projects/plx', true],
  ['keyword', 'chainring', 'projects/plx', true],
  ['keyword', 'sokogen', 'projects/sokogen', true],
  ['keyword', 'e-moto', 'projects/emoto', true],
  ['keyword', 'emoto', 'projects/emoto', true],
  ['keyword', 'moto', 'projects/emoto', true],
  ['rule', 'weekends', 'Weekend shifts at Mountain Sun are fixed. Never plan work over them.', true]
];

// Quotes rows: [text, author, active] — Cy's own quotes get added below these.
const DEFAULT_QUOTES = [
  ['Discipline is just remembering what you want.', '', true],
  ['Build the thing you would want to inherit.', '', true],
  ['Slow is smooth. Smooth is fast.', '', true],
  ['Leave it better than the trail you found it on.', '', true],
  ['Autonomy is earned in the small, boring hours.', '', true],
  ['Do the next right rep. Then the next one.', '', true]
];

if (typeof module !== 'undefined') module.exports = { HEADERS, DEFAULT_CONTEXT, DEFAULT_QUOTES };
