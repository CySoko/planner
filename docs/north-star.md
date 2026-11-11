# SOKOGEN Planner — North Star

*Working draft. Owned and edited by Cy only. Claude references this before every design or build change and flags anything that conflicts with it.*

## Why this exists

Right now I pull out my actual notebook, write the date at the top, and write a giant list of check boxes. It starts with my classes: under each class I write every single thing I can think of that I need to do, whether it's due today or due in a week. Under that is an extraneous / life section: going and talking to people, phone calls, laundry, talking to the bank. Then I look at all of it together, circle what I need to do today, and then pick what I need to do right now while I'm sitting at my desk. I rewrite this list pretty much every day.

The planner is that ritual, without the rewriting.

## The core model: three zoom levels

1. **Everything** — the master list. Every open item, grouped by class and by area (School / Life / Projects). The thing I rewrite in my notebook every day; here it just persists.
2. **Today** — everything dated today plus everything I've starred, in one list. The biggest, first thing on the page.
3. **Right now** — what I'm doing while I'm sitting at my desk. I pick this myself from Today; no separate focus view.

Moving an item between these levels should be as quick as circling it with a pen. On screen, the circle becomes a star.

## Capture: say it once, never lose it

- I think of something, open my phone, say "Hey Siri, add task," and say it. Example: "Remember to call Ian tonight about his Peter Millar shirt."
- I never have to worry about losing that information. It's going to sit in my planner.
- If it's obvious, it goes straight to the right place. That example goes on Tuesday's to-do list for tonight, under Life, not just a scratch box.
- If it's confused, it sits in the Inbox until it's sorted.

## Big tasks and their steps

- Big tasks have a deadline; their small steps can have their own date or timing.
- Example: my abroad physical is due on the 20th, but printing the paperwork and taking it to Wardenburg is due today.
- A dated step shows up on its day in This Week, tagged with its parent task.
- *(This replaces the earlier decision that sub-steps are a plain checklist with no dates.)*

## Stars mean urgent

- A star means urgent: I need to get this done. It doesn't mean due today, and it doesn't need a date.
- Only I add stars. The planner never stars anything automatically.
- A star never expires. If I star something Tuesday and don't get to it, it carries over to Wednesday, and so on until I finish it or unstar it.
- No "starred since" tags. I keep my own mental note of what keeps getting pushed back.
- Things dated today don't need a star; they show up in Today and in today's column on their own.

* Starred items sit at the top of Today's column every day until they're done.

## Layout: Today first

- Today is the hero: large, and one of the first main things on the page.
- Today isn't a separate panel: it's the first, widest column of This Week (see sketch below).
- Today is one list, ordered like my notebook: school items first, each with a small class label, not big headers; then projects; then life at the bottom.
- The School tab has one section per class (five classes), and I add things inside each one.

## Areas pages

- The Areas pages are the "Everything" level: the full master list. Today and This Week are for doing.
- School: one section per class. Inside each class, one flat list, because there aren't that many assignments.
- Bigger assignments (like the Gen AI final) have their sub-tasks listed under them.

* Sub-tasks are collapsed by default, with a small progress count on the parent (like "2 of 5"). I expand one when I'm working on it.

- Life: one flat list, no sections.

* Projects: my personal projects, plus personal things and goals I want.

- Projects is structured like School: each project is one thing with a bunch of sub-things under it. There won't be many; the point is to keep them fresh on my mind.

## Home page sketch (Nov 10)

- **Top bar:** SOKOGEN wordmark on the left; today's date (Tue 11.10), a + add button and the theme toggle on the right.
- **Banner:** a wide strip across the top with the breathing orb and the daily quote.
- **This Week (main panel):** day columns side by side. Today comes first and widest, with full task cards (checkbox, title, description). The next days are narrower and more compact, and later days scroll sideways.
- **Right sidebar:** Quick Notes (a short checkbox list) on top, then Inbox, then Areas with School, Life and Projects cards.

## On the phone

- Opening it on my phone starts with a mini breathe animation that fades out into the actual page.
- Then the quick add button comes first, for fast capture, and Today comes second.

* A tap skips the breathe animation.

## Offline and sync

- When I add something offline (say, on a plane), a quiet dot that means "saved, will sync" is enough. No counts or banners.

## What the notebook actually does

Context only. The planner is meant to replace the notebook and be better, not replicate it.

- A filled box means done; a circle means today; a star means urgent.
- Numbers (1 to 5) set the order I'll run errands in.
- A boxed list on the side holds what I'm doing right now.
- Unfinished things get rewritten onto the next day's page.
- Projects get a heading with their own sub-items under it (NVC, Gen AI, Sound, Extraneous).

## Ordering and checking off

- Lists stay in the order I added things, like my notebook. I drag items to reorder them myself.
- Checking a box crosses the item out and highlights it, the way Today already works. This Week, and every other list, works the same way.
- Finished items stay put until I clear them myself.
- A "Clear finished tasks" button at the bottom clears them.

* A "View completed tasks" button sits next to it. It's mostly a record I can check back on; unchecking something there sends it back to its list.

## Task anatomy and editing

- Every task has a little title, even the small ones, like my Goldn planner. Simple tasks are just the title; less simple ones get a title and a short description.
- I can edit both the title and the description.
- On laptop: hover over a task and hit a little edit button.
- On iPhone: swipe a task, like in Mail, to get edit and delete.

## Adding by hand

- One add-task box, not two separate tools.
- By default it's one quick line that gets sorted automatically, like a Siri capture.
- Before it saves, it shows its guess (area, class, date) so I can fix it with one tap.
- A small "more" toggle expands it into a form: title, description, and class and date as dropdowns.

* Each day in This Week has its own "add task" at the bottom. It's the same add-task box (quick line, guess preview, "more" form), with that day's date already filled in.

- If what I type names a date ("Thursday") under a different day's column, the date I said wins. The column's date is only the default.

## Sorting the Inbox

- I sort confusing captures myself: tap one and it opens the same form as "more".
- Whatever it's confident about is already filled in; the fields it's confused about are highlighted for me to complete.

## How it should feel

The user interface is really important for how I'm going to use this. Small things I don't notice until they go wrong count as real bugs. Reference standards: Apple's Human Interface Guidelines and Nielsen's ten usability heuristics.

- **Never lose my input.** Clicking or brushing outside a text box never wipes what I typed. It keeps a draft or does nothing.
- **Forgiving.** Every delete, move or edit can be undone. Destructive actions need an undo option, not a scary popup.
- **Instant feedback.** Every tap or click visibly responds right away: saved, moved, checked.
- **Fewest steps.** Common actions (add, check off, move to today) take one or two actions, not menus.
- **Predictable.** The same gesture does the same thing everywhere. Nothing moves or reflows unexpectedly while I'm typing.
- **Easy on the thumb.** On iPhone, targets are big enough to hit and main actions sit within thumb reach.
- **Recognition over recall.** I can see my options rather than remembering hidden tricks.

## Open questions

- None right now.

## Parked ideas (maybe later)

- The Projects card on the home page could show each project's name with its next unchecked step, so projects stay visible without clicking in.
