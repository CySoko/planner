# SOKOGEN Planner: rules for Claude Code

Cy's personal planner. The site is plain HTML/CSS/ES modules served by GitHub Pages at cysoko.github.io/planner, with no build step. The data lives in the Google Sheet "SOKOGEN Planner (Live)", reached through a bound Apps Script web app.

- Design spec: `docs/superpowers/specs/2026-11-02-sokogen-planner-design.md`
- Build plan: `docs/superpowers/plans/2026-11-02-sokogen-planner.md`

## How Cy works (read first: saves tokens)
- Cy previews with **VS Code + Live Server**. The page reloads on every save, so **never launch a browser, take screenshots or start a server to check your work** unless Cy asks. Make the change, say what changed, and stop.
- One change per request. Go straight to the file in the map below instead of searching the repo. Read only the section you need, never whole folders.
- Ask a short question when the target is unclear; don't explore to guess it.

## File map
| To change | File | Where |
|---|---|---|
| Any color (light + dark) | `css/tokens.css` | `:root[data-theme="light"]` and `[data-theme="dark"]` blocks |
| Header, wordmark, date, theme switch | `css/app.css` `/* header */`, `/* buttons */` | markup in `index.html` |
| "+ add task" box | `css/app.css` `/* palette */` | markup in `index.html`, logic in `js/main.js` actions |
| Breathing orb + quote | `css/app.css` `/* always remember */` | markup in `js/views/landing.js` |
| This week itinerary (day blocks, rows, time labels) | `css/app.css` `/* this week */` | `js/views/landing.js` (`row()`), dates/grouping in `js/model.js` (`groupByDay`) |
| Today scratchlist | `css/app.css` `/* scratch panel */` | `js/views/scratch.js`, logic in `js/main.js` `// ---------- scratch ----------` |
| Areas doors + stats | `css/app.css` `/* areas */` | `js/views/landing.js` |
| School / Life / Projects pages, item cards, checklists | `css/app.css` `/* area pages */` | `js/views/area.js` |
| Inbox review cards | `css/app.css` `/* inbox */` | `js/views/inbox.js`, accept logic in `js/model.js` (`acceptCapture`) |
| Bottom status bar | `css/app.css` `/* status bar */` | `js/main.js` `renderStatus()` |
| Phone layout | `css/app.css` `@media (max-width: 700px)` at the end | |
| Shared view helpers (escape, labels, checkbox) | `js/views/ui.js` | |
| Saving, syncing, offline queue, clicks/keys | `js/main.js` | sections: rendering, data, scratch, actions, events |
| Sheet columns / tabs | `apps-script/Schema.js` | backend: needs clasp push + Cy's OK to deploy |
| Capture parsing rules | `apps-script/Parse.js` | tests: `tests/fixtures/phrases.json` |

## Always
- Run `npm test` before every commit. Logic changes come with a test. Pure functions belong in `js/model.js` and `apps-script/*.js`.
- Sheet columns: never reorder or delete them. New columns go only at the END of a list in `apps-script/Schema.js`. Then Cy re-runs `setupSheet`, which appends the missing headers safely.
- Nothing gets filed into Items without Cy confirming it in the Inbox.
- Keep the visual system in the spec. Colors live in `css/tokens.css`. Headings use Racing Sans One with `font-synthesis: none`, body text uses Inter, details use JetBrains Mono. Light mode is the default. All motion stops under `prefers-reduced-motion`.

## Apps Script (clasp)
- The code is in `apps-script/`. clasp pushes those files to the bound script, and `.js` files show up as `.gs` in the editor.
- Each file ends with `if (typeof module !== 'undefined') module.exports = …` so Node tests can load it. Keep that line.
- Pushing code (`npx @google/clasp push`) is fine after the tests pass. Pushing does not change the live web app.
- DEPLOYING changes the live web app, which the site and the Siri shortcut both use. Before deploying:
  1. Describe the change to Cy and **wait for his explicit OK**.
  2. Update the EXISTING deployment only, so the /exec URL never changes:
     `npx @google/clasp deploy -i AKfycbwJ2ny0bgtCA9Nsb_ObAF6TA8vdzD1fEiyOOe_8Z_r8IgltbwYzPaLtbt9etKfFfSEW -d "<what changed>"`
  3. Never run `clasp deploy` without `-i`, because that creates a new URL and breaks the site and Siri.
  4. After deploying, ask Cy to open `<exec URL>?action=all` and confirm it shows `{"ok":true`.
- The /exec URL is in `js/config.js`. Never change it.

## Apps Script workflow
- apps-script/ in this repo is the only place backend code is edited. Never suggest editing in the Apps Script web editor.
- After backend changes: run `npm test`, commit, then `npx @google/clasp push`.
- `clasp push` only updates the draft code. Making it live needs
  `npx @google/clasp deploy -i AKfycbwJ2ny0bgtCA9Nsb_ObAF6TA8vdzD1fEiyOOe_8Z_r8IgltbwYzPaLtbt9etKfFfSEW -d "<what changed>"`
  and only after Cy says OK. Never deploy without -i.
- Never run `clasp pull` without checking `git status` first. It overwrites local files.