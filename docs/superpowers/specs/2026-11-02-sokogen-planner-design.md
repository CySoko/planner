# SOKOGEN Planner: Design Spec v1

The living source of truth is the Doc: https://claude.ai/artifact/8JC4jUHVtuadzJ1ct2XxLe (approved 2026-11-02). This file is a copy of the decisions so they live with the code.

## Purpose
One planner for School, Life and Projects. Most capture happens by voice on an iPhone, and planning happens on a laptop. It has to work anywhere, including abroad in spring 2027. Big items (a deadline or a goal) open into checklists of steps. Steps have no dates.

## Architecture
- A static site in this repo, served by GitHub Pages at cysoko.github.io/planner. There is no build step.
- One Apps Script web app, bound to the Sheet "SOKOGEN Planner (Live)" in the Drive folder "Planner". It handles reads, writes and the rules parser. Its /exec URL never changes. To update it, use Manage deployments, then New version.
- A Siri shortcut sends what you say to the same /exec URL.
- Claude reads and writes the Sheet through the Google Drive and Google Sheets connectors. This was confirmed working on 2026-11-02.

## Data model
The Sheet has six tabs, defined in `apps-script/Schema.js`. Never reorder or delete columns, and add new ones only at the end.

## Capture and sorting
Everything lands in the Inbox first. The rules parser rates each guess as sure, unsure or none. Rows rated unsure or none get a suggestion from Claude's nightly sort. Nothing is filed until Cy confirms it. Every correction is written to the Log tab.

## Screens
Landing, School, Life, Projects and Inbox. Landing and School are prototyped at https://claude.ai/artifact/StbTmw3ZJm296yp1MoC6oj.

## Visual system
Light mode is the default, with a dark switch. Headings use Racing Sans One, body text uses Inter, and small details use JetBrains Mono.

| Role | Light | Dark |
| --- | --- | --- |
| Background | #F3F3F7 | #080810 |
| Text | #15151F | #F0F0FF |
| Secondary text, dates | #5A5A7A | #A8A8C8 |
| School | #D42A3C | #FF5C6C |
| Life | #128A50 | #4DFF9E |
| Projects | #0A6FA8 | #4DC8FF |

## Offline
The page shows a cached copy and keeps a local queue of changes. If the same row is edited in two places, the newer `updated` wins.

## Out of scope for v1
An AI API, push notifications, calendar sync, sharing with others, a passphrase, and dates on steps.
