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

## Known local anchors

- View automation script: `scripts/gh-create-views.mjs`
- Primer portal memory: `memory/feedback_primer_dialog.md`
- Run with reapply: `npm run views:fix`
- Dry run (no browser): `npm run views:dry`
