# SOKOGEN Planner — Design Brief

*Draft for Cy's review. Once approved, this goes into the repo for Claude Code to read on every UI task. If this brief and the frontend-design plugin disagree, this brief wins. The North Star decides what the planner does; this brief decides how it looks and feels.*

## 1. Identity

This planner reads like it was designed by a genius firmware and software engineer who also had access to AI. They treat an interface the way they treat firmware: every state accounted for, nothing wasted, nothing that surprises the person using it. They care that a tired person at midnight can get a thought down in two seconds and trust it's safe.

Function is the floor, not the ceiling. On top of it sits SOKOGEN taste: the page should feel **interesting** and **interactive** at a glance.

- **Interactive** mostly means rich, satisfying responses when touched. Ambient motion is rare and subtle (like the breathing orb) and never pulls focus.
- **Interesting** is led by bold typography. Texture and depth support it, and small hidden details reward use over time.

## 2. Principles as rules

Each rule is something you can check, not a mood.

- **Nothing jumps.** Loading, syncing, checking off or adding an item never shifts the layout around it. Space for content is reserved before the content arrives.
- **Every action answers instantly.** A tap, click or keypress visibly changes something right away. The page updates first and syncs in the background; no waiting on the network to show a result.
- **Every state is designed.** Each component has a deliberate look for empty, loading, offline, error, a very long title, and a lot of items. None of those is left to chance.
- **One spacing scale.** Every margin, gap and padding comes from the spacing scale in section 3. No one-off pixel values.
- **Numbers line up.** Dates, times and counts use tabular figures (`font-variant-numeric: tabular-nums`) so columns of digits align.
- **Information over decoration.** Every visual element carries meaning. If removing it loses no information, it goes.
- **Status is honest.** The sync dot and any count shows the real state, never an optimistic guess.
- **Motion has a job.** Animation only explains a change (something appeared, moved or finished). It's short and eases out, and everything respects `prefers-reduced-motion`. The breathing orb is the one deliberate exception. Completing something can get a very subtle flourish (a small, quick pop), never a celebration.
- **Thumb-sized.** On the phone, every tap target is at least 44×44 points, per Apple's Human Interface Guidelines.
- **Readable first.** Body text meets WCAG AA contrast (4.5:1) in both light and dark mode.
- **Keyboard complete.** On the laptop, everything can be done from the keyboard: Enter saves, Escape closes without throwing away what was typed.

## 3. Tokens

Colors and type below are the current system from the handoff. Spacing, radius and motion are **proposed** and need checking against `css/tokens.css` before they're treated as final.

### Color

| Role | Light | Dark |
| --- | --- | --- |
| School | #D42A3C | #FF5C6C |
| Life | #128A50 | #4DFF9E |
| Projects | #0A6FA8 | #4DC8FF |
| Dates | #5A5A7A | #A8A8C8 |
| Background | #F3F3F7 | #080810 |
| Text | #15151F | #F0F0FF |
| Unsure guesses | #9A6A00 | #FFD27A |
| Stalled goals | #5A3FE0 | #A48BFF |

Designed dark-first: dark is the real version and light is the adaptation. By default the planner follows the device's appearance setting (dark at night, light in daylight when the phone is on automatic), and the theme switch overrides it. Red accents. No background gradient.

### Type

- Racing Sans One: headers and the SOKOGEN wordmark.
- *IBM Plex Sans: body text (replaces Inter, chosen Nov 11 for more character while staying readable).*
- IBM Plex Mono: small details only, never body text (replaces JetBrains Mono so the two fonts match).
- Important items are bigger and bold. Itinerary uses small weekday labels with no month.

### Spacing (proposed)

A 4px base: 4, 8, 12, 16, 24, 32, 48.

### Radius (proposed)

Small controls 6px, cards 10px, pills fully rounded.

### Motion (proposed)

- Micro feedback (checkbox, hover, press): about 120ms, ease-out.
- Panels and expanding sections: about 200ms, ease-out.
- Breathing orb: dot orbits once every 16 seconds (existing spec).
- Breathe intro on the phone: length for Cy to decide; a tap always skips it.

## 4. Banned defaults

Never reach for these:

- Background gradients.
- The stock AI palette: purple on white, or a generic blue primary button. Accents come from the area colors and SOKOGEN red.
- Generic fonts (Roboto, Arial, system UI) as a fallback look.
- Code cosplay: terminal green, fake console prompts, monospace body text, blinking cursors.
- Decorative shadows or glows that don't signal anything.
- Emoji used as icons.
- "Are you sure?" popups for deletes. Use undo instead.
- Spinners for actions that happen on the device. Show the result immediately.
- Toast notifications for routine success.
- Marketing landing-page layouts (big centered hero, feature grids). This is a tool, not a sales page.
- Any input that clears itself when it loses focus.
- Placeholder or fake data left in the UI.

This list is open-ended. Cy will add to it as things come up.

## 5. References

*Cy is collecting these.* References are **inspiration, not rules**. They inform mood and taste; they never override the identity, principles or tokens above, and nothing is copied from them directly. Each reference can carry a short note on the qualities it seems to share, but a note is optional. Most references are showcase sites, built to be admired once; the planner is a practical tool used many times a day. Borrow their aesthetic qualities, never their trade-offs against usability: readability and speed come first.

## 6. Interaction rules

Pulled from the North Star. If the two ever disagree, the North Star wins.

- **Never lose input.** Clicking or brushing outside a text box keeps a draft or does nothing.
- **Forgiving.** Every delete, move or edit can be undone.
- **One add box everywhere.** The main add button and each day's add-task in This Week are literally the same component: a quick line that's sorted automatically and shows its guess before saving, plus a "more" toggle that opens a form with title, description, and class and date dropdowns. A date typed in the text beats the column's date.
- **Editing.** Laptop: hover a task and hit a small edit button. Phone: swipe, like Mail, for edit and delete. Title and description are both editable.
- **Checking off.** Checking a box crosses the item out and highlights it, the same way in every list. Finished items stay until "Clear finished tasks"; "View completed tasks" sits next to it, and unchecking there sends an item back.
- **Stars.** Only Cy adds them. They mean urgent, never expire, and sit at the top of Today's column until done.
- **Order.** Lists keep the order items were added; drag to reorder.
- **Collapsing.** Sub-tasks are collapsed by default, with a small "2 of 5" count on the parent.
- **Offline.** A quiet dot means saved and waiting to sync.

## 7. Done checks

### Claude Code checks before saying a change is done

- Only the file that owns the change was touched, and it's one change.
- `npm test` passes, every test.
- No new hard-coded colors, spacing or timings: everything uses tokens.
- Every state of the changed component is handled: empty, long title, many items, offline.
- Inputs it touched keep their text on blur, Enter and Escape.
- `prefers-reduced-motion` is respected for any new animation.
- Nothing in the Sheet schema or deployment was changed.
- It doesn't open a browser, take screenshots or start a server unless Cy asks. Live Server already shows the page.

### Cy checks in Live Server

- No console errors in light and dark mode.
- Looks right at phone width (700px and under) and on the laptop.
- Type in the changed input, then click away (laptop) or swipe or tap away mid-typing (phone): nothing is lost.
- Nothing jumps when the page loads or syncs.

### Review lens: Dieter Rams

Rams' 10 principles are a review lens, not the identity. They cut waste; SOKOGEN supplies the character. Run with the `rams-review` skill (`.claude/skills/rams-review/SKILL.md`) when Cy asks. Bold type, depth, the breathe intro and the subtle completion pop are deliberate and never flagged as excess.
