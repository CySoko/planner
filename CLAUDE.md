# SOKOGEN Planner: rules for Claude Code

Cy's personal planner. The site is plain HTML/CSS/ES modules served by GitHub Pages at cysoko.github.io/planner, with no build step. The data lives in the Google Sheet "SOKOGEN Planner (Live)", reached through a bound Apps Script web app.

- Design spec: `docs/superpowers/specs/2026-11-02-sokogen-planner-design.md`
- Build plan: `docs/superpowers/plans/2026-11-02-sokogen-planner.md`

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
