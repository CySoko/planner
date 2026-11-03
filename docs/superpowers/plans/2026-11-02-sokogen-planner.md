# SOKOGEN Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A personal planner for School, Life and Projects. You capture by voice on iPhone, plan on a laptop, and it works offline. Its data lives in a Google Sheet that Claude can also read and write.

**Architecture:** A static site (HTML, CSS and ES-module JavaScript) at the root of a GitHub repo, served by GitHub Pages. One Apps Script web app reads and writes a Google Sheet with six tabs, and it runs the rules parser. The page and the Siri shortcut only talk to that web app. Claude only talks to the Sheet.

**Tech Stack:** Vanilla JS (ES modules, no build step), Google Apps Script (V8), `clasp` for pushing script files, Node 20+ built-in test runner (`node --test`) for every pure function.

**Spec:** SOKOGEN Planner — Design Spec v1 (https://claude.ai/artifact/8JC4jUHVtuadzJ1ct2XxLe), exported to `docs/superpowers/specs/2026-11-02-sokogen-planner-design.md` in Task 1. Visual reference: prototype canvas https://claude.ai/artifact/StbTmw3ZJm296yp1MoC6oj

## Global Constraints

- No build step for the site. Files are served exactly as committed. Dev-only tooling (tests, clasp) is allowed.
- Sheet columns are never reordered or deleted. New columns only go at the end. `HEADERS` in `apps-script/Schema.js` is the single source of truth.
- The Apps Script `/exec` URL never changes. To update, use Manage deployments → New version, never a new deployment. Save before deploying. Describe the change to Cy and wait for his OK before deploying, then confirm the live page loads.
- Nothing is filed into Items without Cy confirming it in the Inbox. That includes Claude's suggestions.
- No API key, no passphrase, no paid service.
- Light theme is the default, and the dark switch is remembered per device in `localStorage` under the key `sokogen-theme-v2`.
- Colors (light / dark): background #F3F3F7 / #080810 · text #15151F / #F0F0FF · secondary text and dates #5A5A7A / #A8A8C8 · School #D42A3C / #FF5C6C · Life #128A50 / #4DFF9E · Projects #0A6FA8 / #4DC8FF.
- Fonts (Google Fonts): Racing Sans One for headings and the wordmark (no faux bold: `font-synthesis: none`), Inter for body text, JetBrains Mono for small details.
- All motion stops under `prefers-reduced-motion: reduce`. The breath dot orbits once per 16 s, and the ticks sit at 12/3/6/9.
- Steps are plain checkboxes with no dates.

## Review Focus

- **Capture made abroad.** "Tomorrow" said in Prague must mean Prague's tomorrow, even though Apps Script runs on America/Denver time. Every capture carries the client's local ISO time with its offset, and the parser uses that, never the server clock. Test in Task 2 (`relative dates use the supplied offset`).
- **Siri dictation formatting.** Siri adds capitals and a trailing period ("Neuro reading due Thursday."). The parser must give the same result as for the plain lowercase text. Test in Task 2 (`dictation punctuation is ignored`).
- **Empty or huge captures.** Whitespace-only text is rejected with a clear error. A 20,000-character paste is stored whole as raw Inbox text and marked `none` confidence. Test in Task 4 (`validateCapture`).
- **Same row edited on two devices.** The newer `updated` wins. On an exact tie, the existing row stays. Test in Task 3 (`tie keeps existing`).
- **Awkward text.** Commas, quotes, line breaks and emoji in titles and steps must survive the round trip through the Sheet unchanged. Test in Task 3 (`special characters round-trip`).

---

## File Structure

```
index.html                 app shell (all screens, hash-routed)
css/tokens.css             light/dark color variables, fonts
css/app.css                layout + components
js/main.js                 boot: load cache, render, fetch, route
js/api.js                  calls to the /exec URL
js/queue.js                offline change queue (pure + localStorage adapter)
js/model.js                pure helpers: dates, grouping, summaries, repeats, stalled
js/views/landing.js        header, Always Remember, This Week, Areas
js/views/area.js           School / Life / Projects pages
js/views/inbox.js          review cards
js/config.js               EXEC_URL constant
apps-script/Schema.js      HEADERS per tab
apps-script/Parse.js       rules parser (also loaded by Node tests)
apps-script/Store.js       row <-> object, upsert merge (pure)
apps-script/Code.js        doGet / doPost glue to SpreadsheetApp
apps-script/Setup.js       one-time tab + header creation
tests/*.test.mjs           node --test suites
tests/fixtures/phrases.json  parser cases
docs/siri-shortcut.md      shortcut build steps
docs/claude-nightly.md     scheduled-task prompt + Context tab guide
```

Apps Script files end with `if (typeof module !== 'undefined') module.exports = {...}`, so Node can `require` them and Apps Script ignores the line.

---

### Task 0: Spike — can Claude write to a Google Sheet through the Drive connection?

This needs Cy's OK first, because it creates a file in his Drive.

- [ ] **Step 1:** With Cy's OK, create the Sheet `planner-connection-test` through the Google Drive connector, write one row `test, 2026-11-02`, then read it back.
- [ ] **Step 2:** Record the result in `docs/claude-nightly.md`: **WRITE OK** or **READ ONLY**.
- [ ] **Step 3:** If READ ONLY, stop and redesign Task 10 with Cy before continuing. The fallback to discuss: Claude writes suggestions into a Google Doc that Apps Script imports nightly. Ask Cy to delete the test Sheet either way.

### Task 1: Repo, schema and Sheet setup

**Files:** Create `package.json` (`"type":"commonjs"`, `"scripts":{"test":"node --test tests/"}`), `.gitignore`, `.clasp.json` (rootDir `apps-script`), `.claspignore`, `apps-script/Schema.js`, `apps-script/Setup.js`, `tests/schema.test.mjs`, and `docs/superpowers/specs/2026-11-02-sokogen-planner-design.md` (an export of the Doc).

**Interfaces:**
- Produces: `HEADERS: {Items:string[], Steps:string[], Inbox:string[], Context:string[], Quotes:string[], Log:string[]}`, and `setupSheet(): void` (Apps Script only).

- [ ] **Step 1: Write the failing test** `tests/schema.test.mjs`, asserting the exact column lists from the spec:
  - Items = `["id","area","group","title","date","time","type","repeat","status","notes","created","updated"]`
  - Steps = `["id","itemId","text","done","order","updated"]`
  - Inbox = `["id","text","source","capturedAt","guessArea","guessGroup","guessDate","guessType","confidence","suggestion","status"]`
  - Context = `["kind","key","value","active"]`
  - Quotes = `["text","author","active"]`
  - Log = `["inboxId","field","guessed","chosen","at"]`
  - Every tab's headers are unique.
- [ ] **Step 2:** `npm test`, expecting FAIL (module not found).
- [ ] **Step 3:** Implement `HEADERS` in `Schema.js`. Then implement `setupSheet()`, which creates any missing tab, writes the header row only when row 1 is empty, and freezes row 1. It never touches existing columns.
- [ ] **Step 4:** `npm test`, expecting PASS.
- [ ] **Step 5:** Manual check: run `setupSheet` in the Apps Script editor on a new Sheet named `SOKOGEN Planner (Live)`. All six tabs should appear with their headers. Seed Context with Cy's classes (neuro, sound, genai, nvc and their keywords), projects (plx/parallax, sokogen, emoto) and life keywords (lease, rent, shift, abroad, ciee, visa, gilman). Seed Quotes with Cy's quotes plus the six prototype quotes.
- [ ] **Step 6:** Commit with `chore: repo scaffold, sheet schema, setup`.

### Task 2: Rules parser

**Files:** Create `apps-script/Parse.js`, `tests/parse.test.mjs` and `tests/fixtures/phrases.json`.

**Interfaces:**
- Consumes: Context rows `{kind,key,value,active}`. A keyword row looks like `{kind:'keyword', key:'neuro', value:'school/neuro'}`.
- Produces: `parseCapture(text: string, context: object[], nowIso: string, openItems: {id,title,area,group}[]) -> { title, area|null, group|null, date: 'YYYY-MM-DD'|null, time: 'HH:MM'|null, type: 'deadline'|'event'|'do-date', parentId: string|null, confidence: {where, when, type} each 'sure'|'unsure'|'none', alternatives: {where?: string, when?: string} }`.
- `nowIso` always carries an offset (`2026-11-02T20:15:00-07:00`), and every date is computed in that offset.

- [ ] **Step 1: Write failing tests.** Each fixture in `phrases.json` is `{text, now, expect}`, and the suite loops over them. The file starts with the cases below. Cy adds his own until there are at least 30.
  - `"neuro reading due thursday"`, now Mon 2026-11-02 → where `school/neuro` sure, date `2026-11-05` sure, type `deadline` sure
  - `"Neuro reading due Thursday."` → identical to the case above (**dictation punctuation is ignored**)
  - `"sound project friday"` said on Fri 2026-11-06 → date `2026-11-13` unsure, alternative `2026-11-06`
  - `"next friday call with ryo"` on Mon 2026-11-02 → date `2026-11-13` unsure, type `event` sure
  - `"goldn deck for nvc"` → where unsure, with the alternative listed (two keyword matches)
  - `"mountain sun shift saturday at 11am"` → `life/work`, `2026-11-07`, time `11:00`, type `event`
  - `"work on gilman essay tomorrow"` → `life/gilman`, `2026-11-03`, type `do-date`
  - `"in two weeks plx chainring"` → `projects/plx`, `2026-11-16`
  - `"end of the month rent"` → `life/housing`, `2026-11-30`
  - `"buy milk"` → where none, when none, type `deadline` unsure
  - `"for the emergence presentation, rehearse twice"` with an open item titled "Emergence presentation" → that item's `parentId`, title `rehearse twice`
  - `"tomorrow"` with now `2026-11-02T23:30:00+01:00` (Prague) → `2026-11-03` (**relative dates use the supplied offset**)
  - `"Nero reading thursday"` with a Context keyword row `nero → school/neuro` → `school/neuro` sure
  - `"nuero reading thursday"` with no such row → `school/neuro` **unsure**. Fuzzy match: edit distance ≤ 1 against keys of 4 or more letters.
- [ ] **Step 2:** `npm test`, expecting FAIL.
- [ ] **Step 3:** Implement `parseCapture`. First normalize: lowercase, strip trailing punctuation, collapse whitespace. Matching is substring on keyword keys. A weekday names the next occurrence, and the same weekday as today counts as unsure. "Next <day>" always means the occurrence after the coming one and counts as unsure. The title is the text with recognized date and time phrases removed, trimmed. Type words come from the spec's list.
- [ ] **Step 4:** `npm test`, expecting PASS.
- [ ] **Step 5:** Commit with `feat: rules parser with fixture tests`.

### Task 3: Row store and merge

**Files:** Create `apps-script/Store.js` and `tests/store.test.mjs`.

**Interfaces:**
- Consumes: `HEADERS`.
- Produces: `toObjects(tab, rows: any[][]) -> object[]`, `toRow(tab, obj) -> any[]`, and `mergeRows(existing: object[], incoming: object[]) -> {rows: object[], changed: string[]}`, keyed by `id` and compared on ISO `updated`.

- [ ] **Step 1: Write failing tests:**
  - `round-trips every tab`
  - `newer updated wins`
  - `older incoming is ignored`
  - `tie keeps existing`
  - `unknown id is appended`
  - `special characters round-trip`, using the title `Order 48t chainring, "gold" ✨\nline two`
- [ ] **Step 2:** `npm test`, expecting FAIL.
- [ ] **Step 3:** Implement the three functions. Missing fields become `''`, and extra fields are dropped.
- [ ] **Step 4:** `npm test`, expecting PASS.
- [ ] **Step 5:** Commit with `feat: sheet row mapping and merge`.

### Task 4: Web app endpoints

**Files:** Create `apps-script/Code.js` and `tests/code.test.mjs` (pure parts only).

**Interfaces:**
- Consumes: `parseCapture`, `toObjects`, `toRow`, `mergeRows`, `HEADERS`.
- Produces the endpoints:
  - `GET ?action=all` → `{items, steps, inbox, quotes, context, serverTime}`
  - `POST` a text/plain JSON body `{action:'capture', text, source, now}` → `{ok:true, inbox:<row>}`
  - `POST {action:'upsert', tab, rows}` → `{ok:true, changed:[ids]}`
  - Any failure returns `{ok:false, error:<message>}`
- Pure helper: `validateCapture(body) -> {ok:true}|{ok:false,error}`.

- [ ] **Step 1: Write failing tests for `validateCapture`:**
  - Empty or whitespace text is rejected with `"Capture is empty"`.
  - A 20,000-character text is accepted.
  - `source` must be one of `page`, `siri` or `claude`.
  - `now` must parse as ISO with an offset.
  - `upsert` with an unknown tab is rejected.
- [ ] **Step 2:** `npm test`, expecting FAIL.
- [ ] **Step 3:** Implement `doGet`, `doPost` and `validateCapture`. A capture over 2,000 characters skips parsing and is stored with confidence `none`. Use `LockService` around writes. All responses use `ContentService` JSON.
- [ ] **Step 4:** `npm test`, expecting PASS. Then `clasp push`, and with Cy's OK deploy the single web app (execute as Cy, access: anyone).
- [ ] **Step 5:** Manual check: run `curl -L "$EXEC_URL?action=all"` and expect JSON with six keys. Then run `curl -L -H 'Content-Type: text/plain' -d '{"action":"capture","text":"neuro reading due thursday","source":"page","now":"2026-11-02T20:15:00-07:00"}' "$EXEC_URL"` and expect an Inbox row with `guessGroup` = `neuro`.
- [ ] **Step 6:** Commit with `feat: apps script web app endpoints`.

### Task 5: Client data layer and offline queue

**Files:** Create `js/config.js`, `js/api.js`, `js/queue.js` and `tests/queue.test.mjs`.

**Interfaces:**
- Consumes: the Task 4 endpoints.
- Produces:
  - `api.loadAll() -> Promise<Data>`
  - `api.capture(text) -> Promise<InboxRow>`, which sends `now` as local ISO with its offset
  - `api.upsert(tab, rows) -> Promise<{changed}>`
  - `queue.enqueue(state, op) -> state`
  - `queue.flush(state, send: (op)=>Promise) -> Promise<{state, sent:number, failed:number}>`
  - `queue.load()` / `queue.save(state)` using the localStorage key `sokogen-queue-v1`
  - Cache key `sokogen-cache-v1`
- `op` = `{id, kind:'capture'|'upsert', payload, attempts}`

- [ ] **Step 1: Write failing tests:**
  - `flush sends in order`
  - `a failed op stays queued and later ops still send`
  - `attempts increments on failure`
  - `enqueue is idempotent by op id`
- [ ] **Step 2:** `npm test`, expecting FAIL.
- [ ] **Step 3:** Implement. `send` is injected, so tests use a fake. The browser flushes on `online` events and every 30 s while the queue is non-empty.
- [ ] **Step 4:** `npm test`, expecting PASS.
- [ ] **Step 5:** Commit with `feat: api client and offline queue`.

### Task 6: Model helpers and the landing page

**Files:** Create `js/model.js`, `tests/model.test.mjs`, `index.html`, `css/tokens.css`, `css/app.css`, `js/main.js` and `js/views/landing.js`.

**Interfaces:**
- Produces:
  - `quoteForDate(isoDate, quotes) -> quote`: day-of-year modulo the active quotes, so it's the same on every device that day
  - `groupByDay(items, todayIso, days=7) -> [{date, weekday:'MON', num:'02', today:boolean, items}]`
  - `areaSummary(items, steps, area, todayIso) -> {open:number, next:{date,title}|null, pct:number}`
  - `countdown(dateIso, todayIso) -> 'today'|'tomorrow'|'in Nd'|'Nd overdue'`

- [ ] **Step 1: Write failing tests** for each helper. They include: the same quote all day, the next quote at midnight, an empty week returning 7 empty days, done items excluded from `open`, and `pct` = done steps / all steps rounded to a whole number (0 when there are no steps).
- [ ] **Step 2:** `npm test`, expecting FAIL.
- [ ] **Step 3:** Implement the helpers. Then build the landing page to match the prototype's Main artboard:
  - header with the SOKOGEN wordmark, date, "+ add task" and the theme switch
  - Always Remember with the 16 s orbit, four ticks and the quote
  - This Week with compact day blocks (weekday + number only) and two-line rows: bold title, mono meta, time label
  - Areas doors with the inbox count
  - status bar showing synced, saving, or offline with N waiting
  - On phones it stacks in this order: header, Always Remember, This Week, Areas.
  - "+ add task" calls `api.capture` through the queue.
- [ ] **Step 4:** `npm test`, expecting PASS. Open `index.html` through `npx serve .` on laptop and iPhone and compare it with the prototype in both themes.
- [ ] **Step 5:** Commit with `feat: landing page on live data`.

### Task 7: Area pages (School, Life, Projects)

**Files:** Create `js/views/area.js`. Modify `js/model.js` and `tests/model.test.mjs`.

**Interfaces:**
- Consumes: Task 6 helpers, `api.upsert`.
- Produces:
  - `expandRepeats(items, fromIso, days) -> occurrences[]` (weekly only)
  - `isStalled(projectGroup, items, steps, nowIso, thresholdDays=7) -> boolean`: no step checked in the group within the threshold
  - `nextAction(projectGroup, items, steps) -> step|null`: the first unchecked step of the earliest-dated open item

- [ ] **Step 1: Write failing tests:**
  - A weekly shift on Saturdays shows 2 occurrences across 14 days.
  - Stalled is true after 8 idle days and false after 6.
  - The next action skips checked steps.
- [ ] **Step 2:** `npm test`, expecting FAIL.
- [ ] **Step 3:** Implement the helpers and the three pages:
  - **School:** grouped by class, with date block, countdown, a checklist that expands, "add step", and "+ add task" with a class picker.
  - **Life:** deadlines first, then weekly repeats.
  - **Projects:** one card per project with its next action pinned and a stalled badge.
  - Every checkbox and edit writes `updated` = now and goes through the queue.
- [ ] **Step 4:** `npm test`, expecting PASS. Manual check: tick a step on the phone, refresh the laptop, and the step shows as done.
- [ ] **Step 5:** Commit with `feat: school, life, projects pages`.

### Task 8: Inbox review

**Files:** Create `js/views/inbox.js`. Modify `js/model.js` and `tests/model.test.mjs`.

**Interfaces:**
- Consumes: Inbox rows, including `suggestion` JSON written by Claude: `{items:[{area,group,title,date,time,type,steps:[string]}], notes?}`.
- Produces: `acceptCapture(inboxRow, chosen: {area,group,title,date,time,type,parentId,steps}, nowIso) -> {items:[], steps:[], inbox:row, log:[]}`.

- [ ] **Step 1: Write failing tests:**
  - Accepting with no edits writes zero Log rows.
  - Changing the group writes one Log row with the guessed and chosen values.
  - `parentId` set creates Steps only.
  - A Claude suggestion with 3 items creates 3 Items.
  - The Inbox row's status becomes `accepted`.
- [ ] **Step 2:** `npm test`, expecting FAIL.
- [ ] **Step 3:** Implement `acceptCapture` and the review cards:
  - pre-filled fields, unsure fields highlighted with a one-tap alternative
  - accept / edit / dismiss
  - after a group correction, offer "add '<word>' as a keyword for <group>?", which writes a Context row
- [ ] **Step 4:** `npm test`, expecting PASS. Manual check: capture "goldn deck for nvc", choose the alternative, and the Log tab gains a row.
- [ ] **Step 5:** Commit with `feat: inbox review and correction log`.

### Task 9: Siri shortcut

**Files:** Create `docs/siri-shortcut.md`.

- [ ] **Step 1:** Write the steps:
  1. Ask for Text, with the prompt "What's the task?"
  2. Current Date, formatted as ISO 8601 including the time
  3. Get Contents of URL: POST to the /exec URL, JSON body `{action:'capture', text, source:'siri', now}`, header `Content-Type: text/plain`
  4. If the result contains `"ok":true`, speak "Added"; otherwise speak "Didn't save, try again"
  5. Name the shortcut "Add to planner"
- [ ] **Step 2:** Manual check on Cy's iPhone. "Hey Siri, add to planner, neuro reading due Thursday" lands in the Inbox in under 10 s. With airplane mode on, it speaks the failure line.
- [ ] **Step 3:** Commit with `docs: siri shortcut`.

### Task 10: Claude nightly sort (depends on the Task 0 result)

**Files:** Modify `docs/claude-nightly.md`.

- [ ] **Step 1:** Write the scheduled-task prompt:
  - Read the Context, Items and Inbox tabs.
  - For every Inbox row with status `new` and confidence `unsure` or `none` and an empty `suggestion`, write suggestion JSON in the Task 8 shape.
  - Never change any other column. Never touch Items.
- [ ] **Step 2:** With Cy's OK, create the scheduled task nightly at 03:00 in Cy's current time zone. It must state that it needs the Google Drive connector.
- [ ] **Step 3:** Manual check: leave a raw capture, run the task once by hand, and it shows as a suggestion card in the Inbox.
- [ ] **Step 4:** Commit with `docs: claude nightly sort`.

### Task 11: Publish and definition of done

- [ ] **Step 1:** Create the GitHub repo (Cy picks the name), push, and enable Pages from the root of `main`. Set `EXEC_URL` in `js/config.js`.
- [ ] **Step 2:** Run the spec's definition-of-done checklist on iPhone and laptop. Every box must pass, and any failure gets reported with what was seen.
- [ ] **Step 3:** Commit with `chore: v1 release`.
