#!/usr/bin/env node
/**
 * Fix "View 13" roadmap view:
 *   1. Open Date fields → select Start Date + Target Date via menuitemradio
 *   2. Rename the tab to "Roadmap — By Target Date"
 */
import { chromium } from 'playwright';
import { launchEdgeWithCDP, screenshot, delay, CDP_PORT } from './lib/cdp.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ids = JSON.parse(readFileSync(path.join(ROOT, '.github', 'project-ids.json'), 'utf8'));
const SCREENSHOTS = path.join(ROOT, '.gh-views-debug');

const OWNER = 'thisis-romar';
const VIEW_URL = `https://github.com/users/${OWNER}/projects/${ids.projectNumber}/views/13`;

async function main() {
  console.log('Connecting to Edge...');
  await launchEdgeWithCDP(VIEW_URL);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);

  try {
    let page;
    for (const ctx of browser.contexts()) {
      for (const pg of ctx.pages()) {
        if (pg.url().includes('github.com') && pg.url().includes('/projects/')) {
          page = pg; break;
        }
      }
      if (page) break;
    }
    if (!page) {
      const ctx = browser.contexts()[0] ?? await browser.newContext();
      page = await ctx.newPage();
    }

    if (!page.url().includes('/views/13')) {
      await page.goto(VIEW_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await delay(2000);
    }

    // Dismiss welcome dialog if still there
    const gotIt = page.getByRole('button', { name: /got it/i });
    if (await gotIt.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotIt.click();
      await delay(600);
    }

    // ── Step 1: Set date fields via ActionList menu ──────────────────────────
    console.log('\n1. Opening Date fields panel...');
    // Dismiss any lingering overlay first
    await page.keyboard.press('Escape');
    await delay(400);

    // Button has aria-label="Select date fields" and may need force due to toolbar overlay
    const dateFieldsBtn = page.locator('[aria-label="Select date fields"], button:has-text("Date fields")').first();
    await dateFieldsBtn.click({ timeout: 8000, force: true });
    await delay(800);

    // The panel is a roadmap-date-fields-menu overlay with two groups of menuitemradio items:
    //   Group 1 (start): "Start Date", "Sprint start", "No start date"
    //   Group 2 (target): "Target Date", "Sprint end", "No target date"
    // We click the exact text match within the menu.

    const menu = page.locator('[id^="roadmap-date-fields-menu"]').first();
    await menu.waitFor({ state: 'visible', timeout: 5000 });

    // Dump all menuitemradio labels for debugging
    const radioLabels = await page.evaluate(() =>
      [...document.querySelectorAll('[role="menuitemradio"]')]
        .map(el => ({ text: el.textContent.trim(), checked: el.getAttribute('aria-checked') }))
    );
    console.log('  Menu items:', JSON.stringify(radioLabels, null, 2));

    // Menu structure (8 items in 2 groups — confirmed by DOM probe 2026-04-26):
    //   Group 1 (start date slot): [0] Start Date, [1] Target Date, [2] Sprint start, [3] No start date
    //   Group 2 (target date slot): [4] Start Date, [5] Target Date, [6] Sprint end,  [7] No target date
    // → Click [0] to use "Start Date" field for start, click [5] to use "Target Date" field for end.
    const allRadios = page.locator('[role="menuitemradio"]');

    console.log('\n2. Selecting Start Date (item 0)...');
    const startItem = allRadios.nth(0);
    const startChecked = await startItem.getAttribute('aria-checked').catch(() => 'false');
    if (startChecked === 'true') {
      console.log('  Already set.');
    } else {
      await startItem.click({ force: true });
      await delay(600);
      console.log('  ✓ Start Date selected.');
    }

    // Re-open if panel closed after first click
    if (!await menu.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('  Re-opening panel for target date...');
      await dateFieldsBtn.click({ timeout: 5000, force: true });
      await delay(800);
    }

    console.log('\n3. Selecting Target Date (item 5)...');
    const targetItem = allRadios.nth(5);
    const targetChecked = await targetItem.getAttribute('aria-checked').catch(() => 'false');
    if (targetChecked === 'true') {
      console.log('  Already set.');
    } else {
      await targetItem.click({ force: true });
      await delay(600);
      console.log('  ✓ Target Date selected.');
    }

    // Close the panel
    await page.keyboard.press('Escape');
    await delay(600);
    await screenshot(page, 'date-fields-done', SCREENSHOTS);

    // ── Step 2: Rename tab if needed ────────────────────────────────────────
    const viewName = 'Roadmap — By Target Date'; // em dash
    console.log('\n4. Checking tab name...');

    // Check if already named correctly (previous run may have succeeded)
    const alreadyNamed = await page.evaluate((name) => {
      const tabs = [...document.querySelectorAll('[role="tab"]')];
      return tabs.some(t => (t.title || t.textContent || '').trim() === name);
    }, viewName);

    if (alreadyNamed) {
      console.log(`  ✓ Tab already named "${viewName}" — skipping rename.`);
      await screenshot(page, 'final-state', SCREENSHOTS);
      console.log('\n✓ All steps done.');
      return;
    }

    console.log(`  Renaming "View 13" → "${viewName}"...`);
    // Find tab by text "View 13"
    const tab = page.locator('[role="tab"]').filter({ hasText: /^View\s*13$/i }).first()
      .or(page.locator('[role="tab"][aria-selected="true"]').first());

    await tab.dblclick({ timeout: 8000 });
    await delay(700);

    // GitHub renders an <input> inside the tab after double-click
    const renameInput = page.locator('[role="tab"] input, [role="tab"] [contenteditable="true"]')
      .or(page.locator('input[aria-label*="view" i], input[aria-label*="rename" i]'))
      .first();

    if (await renameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await renameInput.fill(viewName);
      await delay(300);
      await renameInput.press('Enter');
      await delay(1500);
      console.log('  ✓ Typed name into input and submitted.');
    } else {
      // Fallback: keyboard only (no visible input — GitHub uses in-place editing)
      await page.keyboard.press('Control+a');
      await delay(100);
      await page.keyboard.type(viewName);
      await delay(300);
      await page.keyboard.press('Enter');
      await delay(1500);
      console.log('  ✓ Typed name via keyboard fallback.');
    }

    // Verify by reading the tab text or page title
    await delay(1000);
    const titleVerify = await page.title().catch(() => '');
    const tabTextVerify = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll('[role="tab"]')];
      const selected = tabs.find(t => t.getAttribute('aria-selected') === 'true');
      return selected?.textContent?.trim() ?? tabs.map(t => t.textContent.trim()).join(' | ');
    });
    console.log(`  Page title: "${titleVerify}"`);
    console.log(`  Tab texts: "${tabTextVerify}"`);

    if (/roadmap/i.test(tabTextVerify) || /roadmap/i.test(titleVerify)) {
      console.log('  ✓ View renamed successfully.');
    } else {
      console.warn('  Rename uncertain — verify in browser.');
    }

    await screenshot(page, 'final-state', SCREENSHOTS);
    console.log('\n✓ Done. Screenshots: ' + SCREENSHOTS);
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error('\nFATAL:', err.message); process.exit(1); });
