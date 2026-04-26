# Playbook: Adding a GitHub Projects v2 View

## When to use which layout

| Layout | Use when | OpenDeck example |
|---|---|---|
| **Table** | You need filtering + sorting by field; scanning many items | Marketplace (filter `area:Marketplace`), Active Work |
| **Board** | You want kanban-style column swimlanes by status or area | Board — By Status, Board — By Area |
| **Roadmap** | You need a timeline across items using Start/Target date fields | Roadmap — By Target |

## Naming convention

OpenDeck view names follow: `<Purpose> — <Grouping/Qualifier>` (em-dash, space-padded).
Examples: `Board — By Status`, `Roadmap — By Target`, `Active Work` (single-purpose, no qualifier needed).

## How to create a view (automated)

`scripts/gh-create-views.mjs` drives Playwright CDP against the GitHub Projects UI. The config array at the top of the file declares each view with `{ name, layout, filter }`.

```js
// In gh-create-views.mjs config:
{ name: 'Sprint Focus', layout: 'table', filter: 'is:open priority:P0' }
```

Run: `npm run views:fix` to create missing views and re-apply filters.

**Critical — always call `setViewLayout()`** even for `table` layout. Skipping it leaves the layout picker open, and `setViewName()` will rename the wrong tab.

## How to create a view (manual, gh CLI)

GitHub Projects v2 does not expose a `gh project view-create` CLI command. Views can only be created via the UI or Playwright automation.

## Saving filters

After setting a filter in the toolbar, a "Save filters" dialog appears via the Primer React portal. The backdrop (`prc-Dialog-Backdrop-*`) intercepts pointer events for everything outside `#__primerPortalRoot__`.

**Always scope the Save click to the portal:**
```js
page.locator('#__primerPortalRoot__ button:has-text("Save")').first()
```

See: `memory/feedback_primer_dialog.md` for full context.

## Dismiss open dialogs before navigating tabs

If a "Save filters for [view]?" dialog is open and you try to click another tab, the click silently fails. Always call `dismissAllDialogs(page)` before and after each tab click in any reapply loop.

## Roadmap view — date field configuration

After creating a Roadmap-layout view, GitHub shows "Welcome to Roadmap! Your project needs at least one date or iteration field." This is not an error — it requires selecting which fields to use for bar start/end.

**The "Date fields" button has `aria-label="Select date fields"`.** Its dropdown is a `[role="menu"]` containing `[role="menuitemradio"]` items in a fixed order (confirmed 2026-04-26):

| Index | Label | Slot |
|---|---|---|
| 0 | Start Date | start |
| 1 | Target Date | start |
| 2 | Sprint start | start |
| 3 | No start date | start (default) |
| 4 | Start Date | target |
| 5 | Target Date | target |
| 6 | Sprint end | target |
| 7 | No target date | target (default) |

To configure via Playwright: click `nth(0)` for start slot → "Start Date" field, `nth(5)` for target slot → "Target Date" field. Use `force: true` if the toolbar has an overlay.

Script for targeted repair: `scripts/gh-fix-roadmap-view.mjs`

## Rename race condition

After creating a view, the script navigates away before the rename commits, leaving the tab named "View N". **Fix (applied 2026-04-26):** a `page.goto(PROJECT_URL)` + 3s settle delay was added after each creation. Ghost views ("View N" not in spec) are auto-deleted in step 3.5 of the script on the next run.

## Known local anchors

- View automation script: `scripts/gh-create-views.mjs`
- Roadmap date field fix: `scripts/gh-fix-roadmap-view.mjs`
- Primer portal memory: `memory/feedback_primer_dialog.md`
- Run with reapply: `npm run views:fix`
- Dry run (no browser): `npm run views:dry`
