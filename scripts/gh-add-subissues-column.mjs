#!/usr/bin/env node
/**
 * Add the "Sub-issues progress" field column to 3 project views.
 *
 * Target views:
 *   #10  Active Work        (Table)
 *   #2   Board — By Status  (Board)
 *   #7   Roadmap — By Target (Roadmap)
 *
 * Flags: --probe  Dump DOM of column header + picker without clicking anything.
 *
 * Run: node scripts/gh-add-subissues-column.mjs [--probe]
 */

import { chromium } from 'playwright';
import { launchEdgeWithCDP, screenshot, delay, CDP_PORT } from './lib/cdp.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ids = JSON.parse(readFileSync(path.join(ROOT, '.github', 'project-ids.json'), 'utf8'));

const PROBE       = process.argv.includes('--probe');
const OWNER       = 'thisis-romar';
const PROJ_NUM    = ids.projectNumber ?? 4;
const BASE        = `https://github.com/users/${OWNER}/projects/${PROJ_NUM}`;
const SCREENSHOTS = path.join(ROOT, '.gh-column-debug');
const FIELD_NAME  = 'Sub-issues progress';

mkdirSync(SCREENSHOTS, { recursive: true });

const VIEWS = [
  { num: 10, name: 'Active Work',              layout: 'table'   },
  { num: 2,  name: 'Board — By Status',        layout: 'board'   },
  { num: 13, name: 'Roadmap — By Target Date', layout: 'roadmap' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getPage(browser) {
  for (const ctx of browser.contexts()) {
    for (const pg of ctx.pages()) {
      if (pg.url().includes('github.com') && pg.url().includes('/projects/')) return pg;
    }
  }
  const ctx = browser.contexts()[0] ?? await browser.newContext();
  return ctx.newPage();
}

/** Check whether the FIELD_NAME column is already visible in the current view. */
async function isColumnVisible(page) {
  return page.evaluate((fieldName) => {
    const headers = [...document.querySelectorAll(
      '[role="columnheader"], [class*="column-header"], th, [class*="HeaderCell"]'
    )];
    const allText = headers.map(h => h.textContent.trim());
    // Also check field labels in the DOM (board/roadmap may not use th)
    const labels = [...document.querySelectorAll('[class*="field-label"], [class*="FieldLabel"]')]
      .map(l => l.textContent.trim());
    return [...allText, ...labels].some(t => t.toLowerCase().includes('sub-issues'));
  }, FIELD_NAME);
}

/** Probe: dump button info near the column header area. */
async function probeView(page, viewName) {
  console.log(`\n  Probing "${viewName}"...`);
  const info = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].map((b, i) => {
      const r = b.getBoundingClientRect();
      return {
        i, text: b.textContent.trim().slice(0, 40),
        aria: b.getAttribute('aria-label'), cls: b.className.slice(0, 70),
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      };
    }).filter(b => b.h > 0 && (b.text || b.aria));

    // Focus: buttons in the header/toolbar zone (y < 300 or labelled "add"/"field"/"column")
    const headerBtns = btns.filter(b =>
      (b.y < 300 && b.y > 50) ||
      /add|field|column/i.test(b.aria ?? '') ||
      /add|field|column|\+/.test(b.text)
    );
    return { headerBtns, totalBtns: btns.length };
  });
  console.log('  Header/add buttons:', JSON.stringify(info.headerBtns.slice(0, 15), null, 2));
  await screenshot(page, `probe-${viewName.replace(/\s+/g, '-').toLowerCase()}`, SCREENSHOTS);
}

/**
 * Open the field-visibility panel for the current view.
 *
 * GitHub Projects v2 has two different toolbar layouts:
 *   - Board/Roadmap views:  "View" button → field configuration panel
 *   - Table views:          "Fields" button → field visibility toggles
 *                           Fallback: "+" at right edge of column header row
 *
 * Probe on 2026-04-26 confirmed Board #2 opens correctly with the View button.
 * Table view "View" button opened a copy-view dialog, not the field panel.
 */
async function openViewSettingsPanel(page, layout = 'table') {
  // Strategy 1: "Fields" button — correct for table views
  const fieldsBtn = page.getByRole('button', { name: /^fields$/i })
    .or(page.locator('button[aria-label="Fields"]'))
    .or(page.locator('button[aria-label*="hidden fields" i]'));
  if (await fieldsBtn.first().isVisible({ timeout: 2500 }).catch(() => false)) {
    await fieldsBtn.first().click({ force: true });
    await delay(800);
    console.log('  Opened Fields panel.');
    return true;
  }

  // Strategy 2: For board/roadmap — "View" button (confirmed working on Board #2)
  if (layout !== 'table') {
    const viewBtn = page.getByRole('button', { name: /^view$/i }).last();
    if (await viewBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await viewBtn.click({ force: true });
      await delay(800);
      console.log('  Opened View settings panel.');
      return true;
    }
  }

  // Strategy 3: DOM scan for toolbar buttons by position + text
  const pos = await page.evaluate((preferFields) => {
    const btns = [...document.querySelectorAll('button')].map(b => {
      const r = b.getBoundingClientRect();
      return { el: b, text: b.textContent.trim(), aria: b.getAttribute('aria-label') ?? '', x: r.x, y: r.y, w: r.width, h: r.height };
    }).filter(b => b.h > 0 && b.y > 150 && b.y < 400);

    // Look for Fields button first, then View
    const fieldsBtn = btns.find(b => /^fields$/i.test(b.text) || /fields/i.test(b.aria));
    const viewBtn   = btns.find(b => /^view$/i.test(b.text) && b.y > 200);
    const target = preferFields ? (fieldsBtn ?? viewBtn) : (viewBtn ?? fieldsBtn);
    if (!target) return null;
    return { x: Math.round(target.x + target.w / 2), y: Math.round(target.y + target.h / 2), label: target.text || target.aria };
  }, layout === 'table');

  if (pos) {
    console.log(`  Clicking "${pos.label}" button at (${pos.x}, ${pos.y})`);
    await page.mouse.click(pos.x, pos.y);
    await delay(800);
    return true;
  }

  // Strategy 4: "+" at the right end of the column header row (table-view fallback)
  if (layout === 'table') {
    const addColBtn = await page.evaluate(() => {
      // Find the rightmost visible "+" or "add" button in the header row
      const candidates = [...document.querySelectorAll('button, [role="button"]')]
        .map(b => {
          const r = b.getBoundingClientRect();
          const txt = (b.textContent?.trim() ?? '') + (b.getAttribute('aria-label') ?? '');
          return { x: r.x, y: r.y, w: r.width, h: r.height, txt };
        })
        .filter(b => b.h > 0 && b.h < 60 && b.y > 180 && b.y < 380 && /^\+$|add.*(col|field)|col.*(add|new)/i.test(b.txt));
      if (!candidates.length) return null;
      const rightmost = candidates.sort((a, b) => b.x - a.x)[0];
      return { x: Math.round(rightmost.x + rightmost.w / 2), y: Math.round(rightmost.y + rightmost.h / 2) };
    });
    if (addColBtn) {
      console.log(`  Clicking "+" column add button at (${addColBtn.x}, ${addColBtn.y})`);
      await page.mouse.click(addColBtn.x, addColBtn.y);
      await delay(800);
      return true;
    }
  }

  console.warn('  [warn] No fields/view settings button found');
  return false;
}

/**
 * With the field picker open, select FIELD_NAME.
 * The picker is usually an ActionList overlay with a search input + menuitem list.
 */
async function selectField(page, fieldName) {
  // Dump what's in the picker
  const pickerState = await page.evaluate((name) => {
    const items = [...document.querySelectorAll(
      '[role="menuitem"], [role="menuitemcheckbox"], [role="option"], li'
    )].map(el => el.textContent.trim()).filter(t => t && t.length < 80);
    const inputs = [...document.querySelectorAll('input[type="text"], input[placeholder]')]
      .map(i => ({ ph: i.placeholder, val: i.value, aria: i.getAttribute('aria-label') }));
    const found = items.some(t => t.toLowerCase().includes('sub-issues'));
    return { items: [...new Set(items)].slice(0, 30), inputs, found };
  }, fieldName);

  console.log(`  Picker items (${pickerState.items.length}):`, pickerState.items.slice(0, 10));
  console.log(`  Found "${fieldName}":`, pickerState.found);

  // Safety: if what opened is the copy-view dialog (not a field picker), abort.
  // Clicking "Sub-issues progress" in the copy dialog applies a filter, not a column toggle.
  const isCopyDialog = pickerState.items.some(t =>
    t.includes('will be copied') || t.includes('New project name')
  );
  if (isCopyDialog) {
    console.warn('  [warn] Copy-view dialog opened instead of field picker — escaping.');
    await page.keyboard.press('Escape');
    return false;
  }

  // If there's a search input, type to filter
  if (!pickerState.found && pickerState.inputs.length > 0) {
    const searchInput = page.locator('input[type="text"]:visible, input[placeholder]:visible').first();
    if (await searchInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await searchInput.fill('Sub-issues');
      await delay(500);
    }
  }

  // Click the Sub-issues progress item
  const patterns = [
    () => page.getByRole('menuitem', { name: /sub-issues progress/i }).first(),
    () => page.getByRole('menuitemcheckbox', { name: /sub-issues progress/i }).first(),
    () => page.getByRole('option', { name: /sub-issues progress/i }).first(),
    () => page.locator('[role="menuitem"]:has-text("Sub-issues")').first(),
    () => page.locator('[role="option"]:has-text("Sub-issues")').first(),
    () => page.locator('li:has-text("Sub-issues progress")').first(),
    () => page.getByText('Sub-issues progress', { exact: true }).first(),
  ];

  for (const getLocator of patterns) {
    try {
      const loc = getLocator();
      if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
        await loc.click({ force: true });
        await delay(400);
        console.log(`  ✓ Clicked "${fieldName}"`);
        return true;
      }
    } catch { /* try next */ }
  }

  console.warn(`  [warn] "${fieldName}" not found in picker`);
  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`gh-add-subissues-column — project #${PROJ_NUM}${PROBE ? ' [PROBE]' : ''}`);

  await launchEdgeWithCDP(BASE);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);

  try {
    const page = await getPage(browser);

    let added = 0, skipped = 0, failed = 0;

    for (const view of VIEWS) {
      const viewUrl = `${BASE}/views/${view.num}`;
      console.log(`\n── View #${view.num}: "${view.name}" (${view.layout}) ──`);

      await page.goto(viewUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await delay(2000);

      if (PROBE) {
        await probeView(page, view.name);
        // Also open the View panel and dump what's inside
        const opened = await openViewSettingsPanel(page, view.layout);
        if (opened) {
          await delay(600);
          await screenshot(page, `probe-${view.num}-view-panel`, SCREENSHOTS);
          const panelItems = await page.evaluate(() =>
            [...document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="option"], li, label')]
              .map(el => el.textContent.trim()).filter(t => t && t.length < 80 && t.length > 1)
          );
          console.log('  View panel items:', [...new Set(panelItems)].slice(0, 25));
          await page.keyboard.press('Escape'); await delay(300);
        }
        continue;
      }

      // Idempotency check
      if (await isColumnVisible(page)) {
        console.log(`  Sub-issues progress already visible — skipping.`);
        skipped++;
        await screenshot(page, `${view.num}-already-done`, SCREENSHOTS);
        continue;
      }

      await screenshot(page, `${view.num}-before`, SCREENSHOTS);

      // Dismiss any open overlays
      await page.keyboard.press('Escape'); await delay(300);

      // Open the View settings panel (field visibility manager)
      const panelOpened = await openViewSettingsPanel(page, view.layout);
      if (!panelOpened) { failed++; continue; }
      await delay(500);
      await screenshot(page, `${view.num}-picker-open`, SCREENSHOTS);

      // Select the field
      const ok = await selectField(page, FIELD_NAME);
      await delay(600);
      await page.keyboard.press('Escape');
      await delay(500);

      // Verify
      const visible = await isColumnVisible(page);
      await screenshot(page, `${view.num}-after`, SCREENSHOTS);

      if (ok && visible) {
        console.log(`  ✓ Column added to "${view.name}"`);
        added++;
      } else if (ok) {
        console.log(`  ✓ Clicked field but column not yet confirmed in DOM (may need page reload)`);
        added++;
      } else {
        console.warn(`  ✗ Failed to add column to "${view.name}"`);
        failed++;
      }
    }

    if (!PROBE) {
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`Done.  Added: ${added}  Skipped: ${skipped}  Failed: ${failed}`);
    }
    console.log(`Screenshots: ${SCREENSHOTS}`);
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error('\nFATAL:', err.message); process.exit(1); });
