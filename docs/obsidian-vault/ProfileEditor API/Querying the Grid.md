---
title: Querying the Grid
created: 2026-04-16
tags: [api, profile-editor, query]
---

# Querying the Grid

## Get Page UUIDs

```js
const pages = editor.getPageUUIDs();
// ["BC6765A1-...", "EBFEE41E-..."]
```

## Get All Actions on a Page

```js
const actions = editor.getActions(pageUUID);
// { "0,0": {...}, "1,1": {...} }
```

## Get a Specific Button

```js
const btn = editor.getAction(pageUUID, 2, 1);
// Action at col=2, row=1 (or null if empty)
```

## Find Empty Positions

```js
const empty = editor.getEmptyPositions(pageUUID);
// [{ col: 3, row: 0 }, { col: 4, row: 2 }, ...]
```

## Find Active Page (with buttons)

```js
let targetPage = null;
for (const uuid of editor.getPageUUIDs()) {
  const actions = editor.getActions(uuid);
  if (actions && Object.keys(actions).length > 0) {
    targetPage = uuid;
    break;
  }
}
```

See also: [[Loading Profiles]], [[Hotkey Buttons]]
