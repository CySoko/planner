# SOKOGEN Planner — Gap List

Nov 11, 2026 · @Cy

## How to use this list

This compares the live code (commit 7d3d3f2, Nov 11) against the North Star and the Design Brief. Items are in the order I'd build them: each phase sits on top of the one before it. Every item is **one change**, names the **file** that owns it, and gets the brief's done checks before it's committed. Items marked **Needs Cy** are decisions, not code. Items marked **Backend** touch the Sheet or Apps Script, so they need `setupSheet` rerun and a deploy with your OK.

## Phase 0: Setup and decisions

### Confirm the live setup (from the handoff)

1. **GitHub Pages shows the latest commit.** Settings → Pages → deploy from `main`, root. Then check the live site after a push. If Pages lags, none of the work below will show on your phone.
2. **`?action=all` returns JSON** and the status bar reads synced.
3. **Rerun `setupSheet`** so Inbox has its guess columns and the Scratch tab exists.
4. **Commit `apps-script/appsscript.json`.** It's still not in the repo.

### Put the spec in the repo

5. **Export the North Star and Design Brief to `docs/`** as Markdown, and add one line to `CLAUDE.md` telling Claude Code to read them before any UI change. Files: `docs/north-star.md`, `docs/design-brief.md`, `CLAUDE.md`.

### Decisions before building (Needs Cy)

6. **Auto-filing vs. the confirmation rule.** The North Star says obvious captures go straight onto the right day. The handoff's hard rule 4 (and `CLAUDE.md`) says nothing is filed without your confirmation and Siri captures always go to Inbox. *Decided Nov 11: obvious captures are sorted automatically, overriding the old rule. Confusing ones still wait in Inbox. Only the rules parser auto-files; Claude's suggestions (including the nightly sort) always wait in Inbox for Cy. Implementation (Backend): in \`apps-script/Code.js\`, when every guess the item needs is rated sure, write it straight to Items and keep its Inbox row as a filed record, so it can be undone. Then update the rule line in \`CLAUDE.md\` in the same change. Cy also updates the project instructions, since they still say nothing is filed without confirmation*.
7. **Five classes or four?** The default Context has four (Neurohacking, Sound, Gen AI, NVC). You mentioned five, and your notebook shows Geog 1001. Decided Nov 11: add it to the live Context tab. Done Nov 11: added "Geography · GEOG 1001" (key geog) to the live Context tab, with keywords geog, geography and 1001. Still to do: add the same rows to the defaults in apps-script/Schema.js with the backend batch.
8. **Life's "Every week" section.** Life currently splits weekly repeats into their own section. The North Star says one flat list. Decided Nov 11: merge into one flat list (item 26).
9. **The stats strip** (this week / deadlines / stalled) isn't in your sketch. Decided Nov 11: keep it for now, to see how it looks in v2.

### New Sheet columns (Backend)

10. Code done Nov 11 (commit ff266bd, tests pass); waiting on Cy to clasp push, rerun setupSheet and deploy. Several features need data the Sheet doesn't store yet. Add these **at the end** of their tabs in `apps-script/Schema.js`, rerun `setupSheet`, push, and deploy with your OK, *before* the front-end work that uses them (the backend silently drops fields it doesn't know):
    - Items: `starred` (for stars), `order` (for drag-to-reorder).
    - Steps: `date` (for dated sub-steps in This Week).
    - Task descriptions can use the existing Items `notes` column, so no new column is needed for those.
    - "Clear finished" can use the existing `status` column (a new `cleared` value), so no new column.

## Phase 1: Foundations

### 11. Never lose input (start here)

I found the likely cause of the text disappearing. Every redraw replaces the whole page body (`render()` in `js/main.js`), and only the Today scratch inputs are protected from it. Redraws happen every 60 seconds, after every sync, when you switch back to the tab, and when you come back online. So anything half-typed in the area-page add form, the edit popover, an "add step" box or an Inbox card gets wiped on the next redraw. On top of that:

- A two-finger swipe on the trackpad is the browser's **Back** gesture. It changes the page, which also closes the add form and throws its text away. That fits "my finger brushes the keypad" pretty well.
- Opening the add box again (⌘K or the button) clears whatever was in it.

**Fix:** keep a draft of every open input across redraws and page changes, not just scratch, and don't clear the add box on reopen. File: `js/main.js` (`render()`, `openPalette()`, the `hashchange` handler). Needs a test for the draft-keeping logic.

### 12. One add-task component

There are three different add UIs today: the top add box (a quick line plus a full guess grid), the area page's "+ add task" form (a separate form with no quick line), and the "add step" row. The North Star wants one.

- Make the top add box the only one: a quick line that shows the guess compactly, with a **more** toggle that reveals the full grid (it currently always shows the grid).
- Make the area page's "+ add task" open that same box, pre-set to that area, instead of its own form.

Files: `js/main.js` (palette section), `index.html` (palette markup), `css/app.css` (`palette`), and `js/views/area.js` (`addForm`, removed). Two changes: the toggle first, then the area-page switch.

### 13. Undo for destructive actions

Undo exists only for filing from the add box. Add it for: deleting a scratch line (Backspace on an empty line), dismissing an Inbox card, and marking an item done from an area page. Keep the undo bar as the one place a toast is allowed; it carries an action, so it isn't the "routine success" toast the brief bans. File: `js/main.js` (toast section and each action). One action per change.

## Phase 2: Today and This Week

### 14. Today becomes the first, widest column of This Week

Right now "Today" is the separate scratch notepad, and This Week's first column is just labelled as today. Per your sketch:

- **14a.** Rename the scratch panel **Quick Notes** and show it only in the sidebar, above Inbox. Files: `js/views/scratch.js` (heading), `js/views/landing.js` (remove the main-column slot).
- **14b.** Make today's column clearly the widest, with full task cards, and the following days narrower. File: `css/app.css` (`this week`).

### 15. Checked-off items stay, crossed out

In This Week, checking an item off makes it vanish, because the day grouping only keeps open items. The North Star wants it crossed out and highlighted until you clear it (Quick Notes already behaves that way). File: `js/model.js` (`groupByDay`), plus a test. The crossed-out style already exists in `css/app.css`.

### 16. Today's order: school, projects, life

Today's column is currently sorted by overdue, then time. Change it to: starred first (after item 17), then school, projects, life, keeping the order things were added within each. Each card keeps its small class label (already there). File: `js/model.js` (`groupByDay`), plus a test.

### 17. Stars (needs item 10)

Add a star toggle to task cards. Starred items sit at the top of Today's column every day until done, whether or not they have a date. Only you add stars, and they never expire. Three changes: the toggle (`js/views/landing.js`, `js/views/area.js`, `js/main.js`), the Today placement (`js/model.js` with a test), and the style (`css/app.css`).

### 18. Dated sub-steps show on their day (needs item 10)

Let a step have its own date, and show dated steps in This Week on that day, tagged with their parent task. Changes: a date field on steps (`js/views/area.js`, `js/main.js` `addStep`), then grouping (`js/model.js` with a test), then the card with the parent tag (`js/views/landing.js`).

### 19. Add task at the bottom of each day

Each day column gets an "add task" at the bottom that opens the **same** add box (item 12) with that day's date filled in. If what you type names a date, your date wins. Files: `js/views/landing.js`, `js/main.js` (palette preset).

## Phase 3: Task anatomy and lists

### 20. Title plus an optional description

Items already have a `notes` column that nothing shows. Use it as the short description: show it under the title on cards when there is one, and add it to the edit form. Files: `js/views/landing.js` (`wkCard` and its edit form), `js/views/area.js` (`card`), `js/main.js` (`saveItemEdit`), `js/model.js` (`applyItemEdit`, with a test).

### 21. Edit from the area pages too

The hover pencil and edit popover only exist on This Week cards. Area-page cards have no way to edit at all, only "Mark done". Add the same hover edit button there. Files: `js/views/area.js`, `js/main.js`.

### 22. Clear finished tasks / View completed tasks

Neither exists yet. Add both buttons at the bottom of each list:

- **Clear finished tasks** sets checked items to a `cleared` status, so they leave the list.
- **View completed tasks** shows done and cleared items as a record; unchecking one there sends it back to its list.

Files: `js/model.js` (the status logic, with a test), then `js/views/area.js` and `js/views/landing.js` (buttons and the completed view), then `js/main.js` (actions). Three changes.

### 23. Order added, then drag to reorder

Area pages currently sort by due date. The North Star says the order you added things, then you drag them around.

- **23a.** Sort by when each item was added (the `created` column, which already exists). File: `js/views/area.js` (`byDate`).
- **23b.** Drag to reorder (needs item 10's `order` column). File: `js/main.js` (pointer events), plus a test for the reorder logic in `js/model.js`. On the phone, the drag gesture must not collide with swipe-to-edit (item 27), so the drag should start from a small handle.

## Phase 4: Inbox and Areas pages

### 24. Inbox cards open on tap

The Inbox already does most of what the North Star asks: confident guesses are pre-filled and unsure fields are highlighted. The difference is that every card is a fully open form all the time. Make each card a compact line (the captured text plus its guess) that opens into the form when tapped. File: `js/views/inbox.js`, with styles in `css/app.css` (`inbox`).

### 25. Checked items stay on area pages too

Area pages also drop an item the moment it's done. Use the same rule as This Week (item 15): crossed out until cleared. Also swap the big "Mark done" button for the same checkbox used everywhere else, so checking off works the same in every list. File: `js/views/area.js`.

### 26. Life as one flat list (depends on decision 8)

If you decide to merge weekly items in, Life becomes a single list. File: `js/views/area.js` (the `life` branch of `renderArea`).

## Phase 5: Phone and feel

### 27. Swipe to edit and delete on the phone

On touch screens the pencil just shows at partial opacity; there's no swipe. Add a Mail-style swipe on task cards that reveals edit and delete. Delete must have undo (item 13). Files: `js/main.js` (touch handling), `css/app.css`.

### 28. Phone opening sequence

- **28a.** Breathe intro: a short breathe animation that fades into the page, skipped with a tap, and skipped entirely under reduced motion. Files: `index.html`, `js/main.js`, `css/app.css`.
- **28b.** Quick add first, then Today: on the phone, make the add button the most prominent thing at the top, with Today's column directly under it. File: `css/app.css` (phone layout).

### 29. Sync status becomes a quiet dot

The status bar currently spells it out ("offline · 3 changes waiting", "couldn't reach the Sheet…"). The North Star wants a quiet dot. One pushback: an *error* shouldn't be quiet, because the brief's honesty rule says status shows the real state. So: a dot that's calm when synced or waiting, and visibly different (with words on tap) only when something is actually wrong. Files: `js/main.js` (`renderStatus`), `css/app.css` (`status bar`).

### 30. Switch to IBM Plex Sans and Plex Mono

The fonts load in `index.html`, and JetBrains Mono is also hard-coded in 11 places in `css/app.css`, not just the `.mono` class. One change across `index.html`, `css/app.css` and the font line in `CLAUDE.md`, so Claude Code's rules match the page.

### 31. Remove the code-cosplay label

The header has a `~/planner :: v1` subtitle, which the brief's banned list rules out. File: `index.html`.

### 32. Subtle completion pop

A small, quick pop when a box is checked; nothing under reduced motion. File: `css/app.css` (`.chk`).

### 33. Turn spacing, radius and motion into tokens

`css/tokens.css` only holds colors. Spacing, radius (8, 10, 12, 16 and 20px are all in use) and motion (0.2 to 0.5s with a custom ease, slower than the brief's proposal) are hard-coded across `css/app.css`. First move the existing values into tokens without changing the look, then decide the final values and update the brief's section 3. Files: `css/tokens.css`, `css/app.css`.

### 34. Theme follows the device by default

The page now opens in light unless you've chosen dark. Change the default to follow the device's appearance setting, with the switch still overriding it and remembered. Files: `index.html` (the inline theme script), `js/main.js` (theme toggle). Then design passes treat dark as the primary look (`css/tokens.css`).

## Already done

The current site already matches these parts of the North Star, so they're off the list:

- **Collapsed sub-tasks with a count.** Area cards are collapsed by default and show a done/total count on the parent.
- **School and Projects structure.** One section per class or project, with a flat list inside. Projects also show a "Next:" step and a stalled badge.
- **Inbox pre-fills and highlights.** Confident guesses are filled in and unsure fields are highlighted, with alternatives one tap away.
- **Hover edit on This Week cards** (laptop), with title, date, time, type and where.
- **Quick Notes behavior.** Checked lines stay crossed out, and unfinished lines from past days can be carried to today.
- **Offline queue.** Changes are saved locally and synced later.
- **Light default, dark switch, reduced motion,** and 44px tap targets on buttons and inputs.
