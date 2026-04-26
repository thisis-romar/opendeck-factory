#!/usr/bin/env node
/**
 * Create 3 canonical Insights charts on OpenDeck Roadmap (project #4).
 * GitHub Projects v2 Insights has no API — drives web UI via Playwright CDP.
 *
 * Charts (from knowledge/github/playbooks/insights-charts.md):
 *   1. Burn-up per Milestone   — Line / X=Time (Historical) / Group=Status / filter milestone:v2.3.0
 *   2. Status by Area          — Stacked bar / X=Area / Group=Status
 *   3. Priority Distribution   — Bar / X=Priority / filter -status:Done
 *
 * Flags: --probe  (dump DOM and exit, no creation)
 *
 * Run: node scripts/gh-create-insights.mjs [--probe]
 */

import { chromium } from 'playwright';
import { launchEdgeWithCDP, screenshot, delay, CDP_PORT } from './lib/cdp.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ids = JSON.parse(readFileSync(path.join(ROOT, '.github', 'project-ids.json'), 'utf8'));

const OWNER        = 'thisis-romar';
const PROJ_NUM     = ids.projectNumber ?? 4;
const INSIGHTS_URL = `https://github.com/users/${OWNER}/projects/${PROJ_NUM}/insights`;
const SCREENSHOTS  = path.join(ROOT, '.gh-insights-debug');
const PROBE        = process.argv.includes('--probe');

mkdirSync(SCREENSHOTS, { recursive: true });

// Confirmed from DOM probe 2026-04-26:
// Layout options: Bar, Column, Line, Stacked area, Stacked bar, Stacked column
// X-axis options: Time (Historical), Area, Assignees, Labels, Milestone,
//                 Parent issue, Priority, Repository, Revenue Impact,
//                 Size, Sprint, Status, Target
// Configure panel: Layout button + X-axis button + Y-axis button + (Group by if stacked) + "Save to new chart"

const CHARTS = [
  {
    name: 'Burn-up per Milestone',
    layout: 'Line',
    xAxis: 'Time',
    groupBy: 'Status',
    filter: 'milestone:v2.3.0',
  },
  {
    name: 'Status by Area',
    layout: 'Stacked bar',
    xAxis: 'Area',
    groupBy: 'Status',
    filter: '',
  },
  {
    name: 'Priority Distribution',
    layout: 'Bar',
    xAxis: 'Priority',
    groupBy: '',
    filter: '-status:Done',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getPage(browser) {
  for (const ctx of browser.contexts()) {
    for (const pg of ctx.pages()) {
      if (pg.url().includes('github.com')) return pg;
    }
  }
  const ctx = browser.contexts()[0] ?? await browser.newContext();
  return ctx.newPage();
}

/**
 * Click a button inside an open dropdown that has matching text.
 * Tries multiple role/selector patterns since GitHub's Primer components
 * use various ARIA roles depending on the component.
 */
async function pickDropdownOption(page, optText) {
  const text = optText.trim();
  const patterns = [
    () => page.getByRole('option',        { name: new RegExp(`^${text}$`, 'i') }).first(),
    () => page.getByRole('menuitem',      { name: new RegExp(`^${text}$`, 'i') }).first(),
    () => page.getByRole('menuitemradio', { name: new RegExp(`^${text}$`, 'i') }).first(),
    () => page.locator(`[role="listbox"] li:has-text("${text}")`).first(),
    () => page.locator(`[role="menu"] li:has-text("${text}")`).first(),
    () => page.locator(`li:has-text("${text}")`).filter({ hasText: new RegExp(`^${text}$`, 'i') }).first(),
    // Broadest fallback: any visible element with exact text, not a heading
    () => page.getByText(text, { exact: true }).nth(0),
  ];

  for (const getLocator of patterns) {
    try {
      const loc = getLocator();
      if (await loc.isVisible({ timeout: 1200 }).catch(() => false)) {
        await loc.click({ force: true });
        await delay(400);
        return true;
      }
    } catch { /* try next */ }
  }

  console.warn(`  [warn] Could not find dropdown option "${text}"`);
  await page.keyboard.press('Escape');
  await delay(300);
  return false;
}

/**
 * Open a configure panel dropdown (Layout, X-axis, Group by) and pick an option.
 * The dropdowns are buttons that show the current value.
 */
async function setDropdown(page, currentValuePattern, newValue) {
  // The panel dropdowns are buttons containing the current selected value
  const btn = page.locator(`button:has-text("${currentValuePattern}")`).first()
    .or(page.locator(`[class*="SelectPanel"] button, [class*="select"] button`).filter({ hasText: new RegExp(currentValuePattern, 'i') }).first());

  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click({ force: true });
    await delay(600);
    return pickDropdownOption(page, newValue);
  }

  // Fallback: scan all visible panel buttons for partial text match
  const panelButtons = await page.evaluate((pattern) => {
    const panel = document.querySelector('[class*="configure" i], aside, [data-testid*="chart-config"]');
    const root = panel ?? document.body;
    return [...root.querySelectorAll('button')]
      .map((b, i) => ({ i, text: b.textContent.trim().slice(0, 40) }))
      .filter(b => new RegExp(pattern, 'i').test(b.text));
  }, currentValuePattern);

  if (panelButtons.length > 0) {
    const idx = panelButtons[0].i;
    const allBtns = page.locator('button').nth(idx);
    await allBtns.click({ force: true });
    await delay(600);
    return pickDropdownOption(page, newValue);
  }

  console.warn(`  [warn] Dropdown with "${currentValuePattern}" not found`);
  return false;
}

// ── Probe ─────────────────────────────────────────────────────────────────────

async function probe(page) {
  await page.goto(INSIGHTS_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await delay(2000);
  await screenshot(page, 'probe-canvas', SCREENSHOTS);

  const ui = await page.evaluate(() => ({
    buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean).slice(0, 50),
    sidebarItems: [...document.querySelectorAll('[class*="chart-link" i], nav li, [role="listitem"]')].map(el => el.textContent.trim()).filter(Boolean).slice(0, 20),
    headings: [...document.querySelectorAll('h1,h2,h3,[role="heading"]')].map(h => h.textContent.trim()).filter(Boolean),
  }));
  console.log('Buttons:', ui.buttons);
  console.log('Sidebar:', ui.sidebarItems);
  console.log('Headings:', ui.headings);
}

// ── Create one chart ──────────────────────────────────────────────────────────

async function createChart(page, chart) {
  console.log(`\n→ "${chart.name}" (${chart.layout} / ${chart.xAxis})`);

  // Always navigate back to Insights first
  if (!page.url().includes('/insights')) {
    await page.goto(INSIGHTS_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await delay(1500);
  }

  // Check if chart with this name already exists
  const alreadyExists = await page.evaluate((name) =>
    [...document.querySelectorAll('[class*="sidebar" i] li, nav li, a[href*="insights"]')]
      .some(el => el.textContent.trim().toLowerCase() === name.toLowerCase())
  , chart.name);
  if (alreadyExists) { console.log('  Already exists — skipping.'); return 'skipped'; }

  // ── 1. Open Configure panel ─────────────────────────────────────────────────
  // Click "Configure" on the active/visible chart (any chart's Configure button works)
  await page.keyboard.press('Escape'); await delay(200); // close any open dropdown
  const configBtn = page.getByRole('button', { name: /configure/i }).first();
  if (!await configBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.warn('  Configure button not found — navigating to Insights and retrying.');
    await page.goto(INSIGHTS_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await delay(1500);
  }
  await page.getByRole('button', { name: /configure/i }).first().click({ force: true });
  await delay(1200);
  await screenshot(page, `${chart.name.replace(/\s+/g,'-')}-01-panel`, SCREENSHOTS);

  // ── 2. Set Layout ───────────────────────────────────────────────────────────
  console.log(`  Layout → ${chart.layout}`);
  // Current layout button shows the selected layout name
  const currentLayout = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    for (const b of btns) {
      const txt = b.textContent.trim();
      if (['Bar','Column','Line','Stacked area','Stacked bar','Stacked column'].includes(txt)) return txt;
    }
    return null;
  });
  if (currentLayout && currentLayout !== chart.layout) {
    await setDropdown(page, currentLayout, chart.layout);
  } else if (!currentLayout) {
    // Try generic approach
    await setDropdown(page, 'Layout', chart.layout);
  }

  // ── 3. Set X-axis ───────────────────────────────────────────────────────────
  console.log(`  X-axis → ${chart.xAxis}`);
  const currentXAxis = await page.evaluate(() => {
    const xAxisFields = ['Time','Area','Assignees','Labels','Milestone','Parent issue',
      'Priority','Repository','Revenue Impact','Size','Sprint','Status','Target'];
    const btns = [...document.querySelectorAll('button')];
    for (const b of btns) {
      const txt = b.textContent.trim();
      if (xAxisFields.includes(txt)) return txt;
    }
    return 'Time'; // default
  });
  if (currentXAxis !== chart.xAxis) {
    await setDropdown(page, currentXAxis, chart.xAxis);
  }

  // ── 4. Set Group by (appears for stacked layouts and some others) ────────────
  if (chart.groupBy) {
    await delay(400);
    const groupByVisible = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      // Group by button shows a field name — look for it in the panel area
      const fieldNames = ['Status','Priority','Area','Target','Size','Revenue Impact','Sprint'];
      for (const b of btns) {
        if (fieldNames.includes(b.textContent.trim())) return b.textContent.trim();
      }
      return null;
    });
    if (groupByVisible && groupByVisible !== chart.groupBy) {
      console.log(`  Group by → ${chart.groupBy}`);
      await setDropdown(page, groupByVisible, chart.groupBy);
    } else if (!groupByVisible) {
      console.log(`  Group by: "${chart.groupBy}" (field not visible in panel — may be set after creation)`);
    }
  }

  await screenshot(page, `${chart.name.replace(/\s+/g,'-')}-02-configured`, SCREENSHOTS);

  // ── 5. Save as new chart ────────────────────────────────────────────────────
  const saveBtn = page.getByRole('button', { name: /save to new chart/i })
    .or(page.locator('button:has-text("Save to new chart")')).first();

  if (!await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.warn('  "Save to new chart" not found — taking screenshot.');
    await screenshot(page, `${chart.name.replace(/\s+/g,'-')}-save-not-found`, SCREENSHOTS);
    return 'failed';
  }

  await saveBtn.click({ force: true });
  await delay(2000);
  await screenshot(page, `${chart.name.replace(/\s+/g,'-')}-03-saved`, SCREENSHOTS);
  console.log('  ✓ Chart created.');

  // ── 6. Set filter on the chart view ────────────────────────────────────────
  if (chart.filter) {
    await delay(500);
    const filterInput = page.locator('input[name*="filter"], input[aria-label*="filter" i]')
      .or(page.getByPlaceholder(/filter by keyword/i)).first();
    if (await filterInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterInput.fill(chart.filter);
      await delay(800);
      // Save the filter
      const saveFilterBtn = page.getByRole('button', { name: /^save$/i }).first();
      if (await saveFilterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveFilterBtn.click({ force: true });
        await delay(600);
        const portalSave = page.locator('#__primerPortalRoot__ button:has-text("Save")').first();
        if (await portalSave.isVisible({ timeout: 1500 }).catch(() => false)) {
          await portalSave.click(); await delay(500);
        }
      }
      console.log(`  Filter set: ${chart.filter}`);
    } else {
      console.warn(`  Filter input not found — set manually: ${chart.filter}`);
    }
  }

  // ── 7. Rename the chart ─────────────────────────────────────────────────────
  // After "Save to new chart", the new chart is shown with a generic name.
  // The title has a pencil/edit icon — click it or double-click the title to rename.
  await delay(500);
  const pencilBtn = page.locator('[aria-label*="rename" i], [aria-label*="edit name" i], button[aria-label*="pencil" i]').first()
    .or(page.locator('[class*="edit" i][class*="title" i]').first());

  if (await pencilBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pencilBtn.click(); await delay(400);
  } else {
    // Double-click the chart title text (the h2/h3 at top of main area)
    const titleEl = page.locator('h2, h3').first();
    if (await titleEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      await titleEl.dblclick(); await delay(400);
    }
  }

  const nameInput = page.locator('input[aria-label*="name" i], input[aria-label*="title" i], h2 input, h3 input').first()
    .or(page.locator('input[type="text"]:visible').first());
  if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nameInput.fill(chart.name);
    await nameInput.press('Enter');
    await delay(600);
    console.log(`  Renamed to "${chart.name}"`);
  } else {
    console.warn(`  Could not rename — name it manually: "${chart.name}"`);
  }

  await screenshot(page, `${chart.name.replace(/\s+/g,'-')}-04-final`, SCREENSHOTS);
  return 'created';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`gh-create-insights — OpenDeck Project #${PROJ_NUM}`);
  console.log(`Insights: ${INSIGHTS_URL}`);
  if (PROBE) console.log('Mode: PROBE');

  await launchEdgeWithCDP(INSIGHTS_URL);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);

  try {
    const page = await getPage(browser);

    if (PROBE) {
      await probe(page);
      return;
    }

    await page.goto(INSIGHTS_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await delay(2000);

    let created = 0, skipped = 0, failed = 0;
    for (const chart of CHARTS) {
      const result = await createChart(page, chart);
      if (result === 'created') created++;
      else if (result === 'skipped') skipped++;
      else failed++;
      await page.goto(INSIGHTS_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await delay(1500);
    }

    await screenshot(page, 'final', SCREENSHOTS);
    console.log(`\n✓ Done. Created: ${created}  Skipped: ${skipped}  Failed: ${failed}`);
    console.log(`Screenshots: ${SCREENSHOTS}`);

    if (failed > 0 || created < CHARTS.length - skipped) {
      console.log(`\nManual steps for any failed charts:`);
      console.log(`  Navigate to ${INSIGHTS_URL}`);
      console.log(`  Click "New chart" → Configure → set Layout/X-axis → "Save to new chart"`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error('\nFATAL:', err.message); process.exit(1); });
