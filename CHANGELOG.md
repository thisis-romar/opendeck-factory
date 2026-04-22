---
title: Changelog
description: All notable changes to opendeck-factory
version: 2.0.0
created: 2026-04-22T00:00:00Z
last_updated: 2026-04-22T00:00:00Z
---

# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [Semantic Versioning](https://semver.org/)

---

## [Unreleased]

## [2.0.0] — 2026-04-22

### Features
- Shared color system (`src/colors.js`) with WCAG-compliant `contrastColor()` for all profile generators
- Reference profile redesign: icon-only composites on per-page solid-color PNG backgrounds (480×272),
  adjacent-page-colored nav corners, live Page Indicator at (4,0) via `Controllers[0].Background` + `States:[{}]`
- `generate-icons.js` now imports from shared `src/colors.js`
- Git hooks infrastructure: `.githooks/` with `pre-commit`, `prepare-commit-msg`, `pre-push`, `commit-msg`, `stop-git-check.sh`
- Conventional Commits enforced via commitlint
- Claude Code stop hook wired via `.claude/settings.json`

### Features (prior)
- FSL-1.1-ALv2 license (auto-converts to Apache 2.0 two years after each release)
- `expand-reference-profile.js` — composite icon tinting, page color system, nav corners
- Drive Windows GUI skill and Capture Reference skill added to `.claude/skills/`
- Multi-action support for chord shortcuts (`Ctrl+K Ctrl+C`)
- `extract` / `pack` / `validate` / `list` CLI pipeline
- Template profile system (`profiles/_template/`)
- Category-coded SVG icon generation for app shortcut profiles
- Multi-device support: MK.2, XL, Mini, Stream Deck +

### Bug Fixes
- Fixed `openApp` icon: replace nested SVG with `<g transform>` for non-144 viewBox icons
- Fixed `extract`/`validate` format mismatch: auto-detect live vs normalized format
- Fixed engine multi-action UUID schema

---

## Release Workflow

```bash
# Bump version, generate changelog, tag, push:
npm version minor               # bumps package.json, creates git tag
git cliff --tag vX.Y.Z > CHANGELOG.md
git add CHANGELOG.md
git commit -s -m "chore: release vX.Y.Z"
git push origin master --tags
```
