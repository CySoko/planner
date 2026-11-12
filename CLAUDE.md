# SOKOGEN Planner: rules for Claude Code

Cy's personal planner. Plain HTML/CSS/ES modules, no build step, served by GitHub Pages at cysoko.github.io/planner. Data lives in the Google Sheet "SOKOGEN Planner (Live)" via a bound Apps Script web app.
Spec: `docs/superpowers/specs/2026-11-02-sokogen-planner-design.md` · Plan: `docs/superpowers/plans/2026-11-02-sokogen-planner.md`
North Star: `docs/north-star.md` · Design Brief: `docs/design-brief.md` · Gap List: `docs/gap-list.md`

## How Cy works
- He previews with VS Code Live Server. Never launch a browser, take screenshots or start a server unless he asks. Make the change, say what changed, stop.
- Prompts arrive pre-planned. A prompt may hold several numbered items: do them in order, one commit per item. Read only the files and functions the prompt names. If anything is unclear, or the code doesn't match the prompt, stop and report; don't explore.
- When an item is done and `npm test` passes, commit and `git push origin main`, then paste the raw push output. Never say something was committed or pushed without showing the output. Then remind Cy to /clear.

## File map
| To change | Styles (`css/app.css` section) | Markup / logic |
|---|---|---|
| Any color, light + dark | `css/tokens.css` theme blocks | |
| Header, wordmark, date, theme switch | `header`, `buttons` | `index.html` |
| "+ add task" box | `palette` | `index.html`; `js/main.js` actions |
| Breathing orb + quote | `always remember` | `js/views/landing.js` |
| This Week itinerary | `this week` | `js/views/landing.js` `row()`; `js/model.js` `groupByDay` |
| Today scratch list | `scratch panel` | `js/views/scratch.js`; `js/main.js` scratch section |
| Area doors + stats | `areas` | `js/views/landing.js` |
| School/Life/Projects pages, cards, checklists | `area pages` | `js/views/area.js` |
| Inbox review cards | `inbox` | `js/views/inbox.js`; `js/model.js` `acceptCapture` |
| Status bar | `status bar` | `js/main.js` `renderStatus()` |
| Phone layout | `@media (max-width: 700px)` at end | |
| Shared helpers (escape, labels, checkbox) | | `js/views/ui.js` |
| Saving, sync, offline queue, clicks/keys | | `js/main.js` (rendering, data, scratch, actions, events) |
| Sheet columns / tabs | | `apps-script/Schema.js` (backend) |
| Capture parsing rules | | `apps-script/Parse.js`; tests in `tests/fixtures/phrases.json` |

## Always
- `npm test` before every commit. Logic changes get a test; pure functions go in `js/model.js` or `apps-script/*.js`.
- Sheet columns: never reorder or delete. Add new ones only at the END of a list in `Schema.js`; Cy then re-runs `setupSheet`.
- Filing: the + add task box files directly; Inbox review files what Cy accepts. Decided Nov 11 but NOT BUILT (don't build it unless asked): captures whose guesses are all rated sure get filed automatically, unsure ones wait in Inbox, and Claude's suggestions always wait in Inbox. The nightly Claude sort (plan Task 10) is dropped.
- Item status: `open`, `done`, `cleared` (finished and cleared off the lists, kept as a record), `archived` (deleted by Cy, hidden everywhere). Use `isOpen` from `js/model.js`; never compare status by hand.
- Visual system per the spec: colors only in `tokens.css`; Racing Sans One headings (`font-synthesis: none`), Inter body, JetBrains Mono details; designed dark-first; the theme follows the device's appearance unless Cy has used the switch; all motion stops under `prefers-reduced-motion`.

## Apps Script (clasp)
- `apps-script/` is the only place backend code is edited; never suggest the web editor. `.js` files appear as `.gs` there.
- Keep the `if (typeof module !== 'undefined') module.exports = …` line at the end of each file (Node tests need it).
- Never `clasp pull` without checking `git status` first; it overwrites local files.
- After backend changes: `npm test`, commit, then `npx @google/clasp push`. Push only updates draft code, not the live app.
- Deploying changes the live app the site and Siri use. Describe the change and wait for Cy's explicit OK, then update the EXISTING deployment only:
  `npx @google/clasp deploy -i AKfycbwJ2ny0bgtCA9Nsb_ObAF6TA8vdzD1fEiyOOe_8Z_r8IgltbwYzPaLtbt9etKfFfSEW -d "<what changed>"`
  Never deploy without `-i` (it creates a new URL and breaks everything). Afterward, ask Cy to open `<exec URL>?action=all` and confirm `{"ok":true`.
- The /exec URL is in `js/config.js`. Never change it.