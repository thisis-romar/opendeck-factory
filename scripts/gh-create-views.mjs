#!/usr/bin/env node
/**
 * Create GitHub Projects v2 views via Playwright + CDP-attach to existing Edge profile.
 * GitHub's public GraphQL API does not expose createProjectV2View — this script drives the
 * web UI directly, reusing the proven CDP pattern from claude-conversation-reader.
 *
 * Requires: Edge running (or restartable), user already logged into GitHub in Edge profile.
 * Run: node scripts/gh-create-views.mjs [--headed] [--dry-run]
 */

import { chromium } from 'playwright';
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const config = JSON.parse(readFileSync(path.join(ROOT, 'data', 'project-items.json'), 'utf8'));
const ids = JSON.parse(readFileSync(path.join(ROOT, '.github', 'project-ids.json'), 'utf8'));

const { owner } = config.project;
const { projectNumber } = ids;
const PROJECT_URL = `https://github.com/users/${owner}/projects/${projectNumber}`;

const CDP_PORT = 9222;
const EDGE_USER_DATA = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data');
const SCREENSHOTS_DIR = path.join(ROOT, '.gh-views-debug');

const HEADED = process.argv.includes('--headed');
const DRY_RUN = process.argv.includes('--dry-run');

// ── View definitions ──────────────────────────────────────────────────────────
const VIEWS = config.views ?? [
  { name: 'Board — By Status',  layout: 'board',   groupBy: 'Status' },
  { name: 'Board — By Area',    layout: 'board',   groupBy: 'Area'   },
  { name: 'Roadmap — By Target',layout: 'roadmap', groupBy: 'Target' },
  { name: 'Active Work',             layout: 'table',   filter: '-status:Done' },
  { name: 'Marketplace',             layout: 'table',   filter: 'area:Marketplace' },
];

// ── Edge / CDP helpers ────────────────────────────────────────────────────────

function getEdgePath() {
  const candidates = [
    path.join(process.env['ProgramFiles(x86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ];
  for (const p of candidates) { if (existsSync(p)) return p; }
  return 'msedge.exe';
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function waitForCDP(maxWait = 30_000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const resp = await httpGet(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (resp.status === 200) return JSON.parse(resp.data);
    } catch { /* not ready */ }
    await delay(1000);
  }
  throw new Error(`CDP endpoint not ready after ${maxWait / 1000}s`);
}

async function launchEdgeWithCDP() {
  // Check if already running with debugging port
  try {
    await waitForCDP(3000);
    console.log('  CDP already open on port ' + CDP_PORT);
    return;
  } catch { /* not running, launch it */ }

  console.log('  Closing Edge...');
  try { execSync('taskkill.exe /F /IM msedge.exe', { stdio: 'pipe' }); } catch { /* not running */ }
  await delay(1500);

  console.log('  Launching Edge with remote debugging...');
  const proc = spawn(getEdgePath(), [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${EDGE_USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    PROJECT_URL,
  ], { detached: true, stdio: 'ignore' });
  proc.unref();

  await waitForCDP(30_000);
  console.log('  Edge CDP ready.');
}

// ── Screenshot helper ─────────────────────────────────────────────────────────

async function screenshot(page, name) {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const p = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  [screenshot] ${p}`);
}

// ── GitHub Projects UI helpers ────────────────────────────────────────────────

async function getOrOpenProjectPage(browser) {
  // Find an existing context that might have github.com open
  for (const ctx of browser.contexts()) {
    for (const pg of ctx.pages()) {
      if (pg.url().includes('github.com')) {
        await pg.goto(PROJECT_URL, { waitUntil: 'domcontentloaded' });
        await pg.waitForLoadState('networkidle');
        return pg;
      }
    }
  }
  // No github page found — open new one in first available context
  const ctx = browser.contexts()[0] ?? await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(PROJECT_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  return page;
}

async function getExistingViewNames(page) {
  // View tabs live in a scrollable tab strip — collect all visible tab labels
  const tabs = await page.locator('[role="tab"]').allTextContents();
  return tabs.map(t => t.trim()).filter(Boolean);
}

async function clickNewViewButton(page) {
  // GitHub Projects v2: "New view" button at the end of the tab bar
  // Try multiple selector strategies in order of reliability
  const strategies = [
    () => page.getByRole('button', { name: /new view/i }),
    () => page.locator('button[aria-label*="new view" i]'),
    () => page.locator('button[aria-label*="New view" i]'),
    // The "+" icon button at the end of the tab strip
    () => page.locator('[data-component="TabNav"] button').last(),
    () => page.locator('nav[aria-label*="project" i] button').last(),
  ];

  for (const strategy of strategies) {
    try {
      const btn = strategy();
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.click();
        await page.waitForTimeout(600);
        return;
      }
    } catch { /* try next */ }
  }

  await screenshot(page, 'new-view-button-not-found');
  throw new Error('Could not find "New view" button. See debug screenshot.');
}

async function setViewLayout(page, layout) {
  if (layout === 'table') return; // Table is the default; nothing to do

  // After a new view is created, GitHub shows layout options in a panel/popover
  // OR we need to switch layout via the toolbar
  // Try the immediate layout selector first (appears right after creating a view)
  const layoutSelectors = {
    board:   [/board/i, /kanban/i],
    roadmap: [/roadmap/i, /timeline/i],
  };

  const patterns = layoutSelectors[layout] ?? [];

  // First: look for a layout picker that appears immediately after "+ New view"
  for (const pattern of patterns) {
    try {
      const btn = page.getByRole('menuitem', { name: pattern });
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.click();
        await page.waitForTimeout(400);
        return;
      }
    } catch { /* try next */ }
  }

  // Second: look for layout options in a dialog/popover
  for (const pattern of patterns) {
    try {
      const btn = page.getByRole('button', { name: pattern });
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.click();
        await page.waitForTimeout(400);
        return;
      }
    } catch { /* try next */ }
  }

  // Third: use the "..." or settings button on the active tab to switch layout
  try {
    // Open the view's configuration panel via the "..." button on the active tab
    const moreBtn = page.locator('[role="tab"][aria-selected="true"] ~ button, [role="tab"][aria-selected="true"] button[aria-label*="more" i]');
    if (await moreBtn.isVisible({ timeout: 2000 })) {
      await moreBtn.click();
      await page.waitForTimeout(400);
      for (const pattern of patterns) {
        const item = page.getByRole('menuitem', { name: pattern });
        if (await item.isVisible({ timeout: 2000 })) {
          await item.click();
          await page.waitForTimeout(400);
          return;
        }
      }
    }
  } catch { /* continue */ }

  await screenshot(page, `set-layout-${layout}-failed`);
  console.warn(`  WARNING: Could not set layout to "${layout}" — manual adjustment may be needed.`);
}

async function setViewName(page, name) {
  // Double-click the active/selected tab to enter rename mode
  try {
    const activeTab = page.locator('[role="tab"][aria-selected="true"]');
    await activeTab.dblclick({ timeout: 3000 });
    await page.waitForTimeout(300);

    // Type the new name, replacing existing
    await page.keyboard.press('Control+a');
    await page.keyboard.type(name);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    return;
  } catch { /* try alternative */ }

  // Alternative: find an inline input that appeared after creating the view
  try {
    const input = page.locator('input[type="text"]:visible').first();
    if (await input.isVisible({ timeout: 2000 })) {
      await input.fill(name);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      return;
    }
  } catch { /* continue */ }

  await screenshot(page, `set-name-failed`);
  console.warn(`  WARNING: Could not rename view to "${name}" — manual rename needed.`);
}

async function setGroupBy(page, fieldName) {
  if (!fieldName) return;

  // "Group by" button in the project view toolbar
  const groupBySelectors = [
    () => page.getByRole('button', { name: /group\s*by/i }),
    () => page.locator('button[aria-label*="group by" i]'),
    () => page.locator('button:has-text("Group by")'),
  ];

  let opened = false;
  for (const sel of groupBySelectors) {
    try {
      const btn = sel();
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.click();
        await page.waitForTimeout(400);
        opened = true;
        break;
      }
    } catch { /* try next */ }
  }

  if (!opened) {
    await screenshot(page, `group-by-button-not-found-${fieldName}`);
    console.warn(`  WARNING: Could not open "Group by" menu for field "${fieldName}".`);
    return;
  }

  // Select the field from the menu
  try {
    const item = page.getByRole('option', { name: new RegExp(fieldName, 'i') })
      .or(page.getByRole('menuitem', { name: new RegExp(fieldName, 'i') }));
    if (await item.isVisible({ timeout: 2000 })) {
      await item.click();
      await page.waitForTimeout(400);
      return;
    }
  } catch { /* try label/checkbox */ }

  // Fallback: find a checkbox/radio labelled with the field name
  try {
    const label = page.locator(`label:has-text("${fieldName}"), [role="option"]:has-text("${fieldName}")`);
    if (await label.isVisible({ timeout: 2000 })) {
      await label.click();
      await page.waitForTimeout(400);
      // Close the menu by pressing Escape
      await page.keyboard.press('Escape');
      return;
    }
  } catch { /* continue */ }

  await screenshot(page, `group-by-field-not-found-${fieldName}`);
  console.warn(`  WARNING: Could not set group by "${fieldName}" — manual adjustment needed.`);
}

async function setFilter(page, filterText) {
  if (!filterText) return;

  // GitHub Projects filter bar — usually an input with placeholder "Filter by keyword or by field"
  const filterSelectors = [
    () => page.getByPlaceholder(/filter/i),
    () => page.locator('input[aria-label*="filter" i]'),
    () => page.locator('input[placeholder*="filter" i]'),
    () => page.locator('[data-testid="project-filter-input"]'),
  ];

  for (const sel of filterSelectors) {
    try {
      const input = sel();
      if (await input.isVisible({ timeout: 2000 })) {
        await input.click();
        await input.fill(filterText);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        return;
      }
    } catch { /* try next */ }
  }

  await screenshot(page, `filter-input-not-found`);
  console.warn(`  WARNING: Could not set filter "${filterText}" — manual adjustment needed.`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nGitHub Projects v2 — View Creator`);
  console.log(`Project: ${PROJECT_URL}`);
  console.log(`Views to create: ${VIEWS.length}`);
  if (DRY_RUN) console.log('DRY RUN — no changes will be made\n');

  if (DRY_RUN) {
    for (const v of VIEWS) {
      console.log(`  [dry-run] Would create: "${v.name}" (${v.layout ?? 'table'}${v.groupBy ? ' grouped by ' + v.groupBy : ''}${v.filter ? ' filter: ' + v.filter : ''})`);
    }
    return;
  }

  // ── 1. Start Edge with CDP ────────────────────────────────────────────────
  console.log('\n1. Setting up Edge CDP connection...');
  await launchEdgeWithCDP();

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  console.log('  Connected to Edge via CDP.');

  try {
    // ── 2. Navigate to project ──────────────────────────────────────────────
    console.log('\n2. Opening project page...');
    const page = await getOrOpenProjectPage(browser);

    // Confirm we're authenticated
    const title = await page.title();
    console.log(`  Page title: ${title}`);
    if (title.toLowerCase().includes('sign in') || title.toLowerCase().includes('login')) {
      await screenshot(page, 'not-authenticated');
      throw new Error('Not authenticated in Edge. Log into GitHub in Edge and re-run.');
    }
    await screenshot(page, '01-project-loaded');

    // ── 3. Get existing view names ──────────────────────────────────────────
    console.log('\n3. Checking existing views...');
    const existingNames = await getExistingViewNames(page);
    console.log(`  Existing views: [${existingNames.join(', ')}]`);

    // ── 4. Create each view ─────────────────────────────────────────────────
    let created = 0;
    let skipped = 0;
    let warned = 0;

    for (const view of VIEWS) {
      const alreadyExists = existingNames.some(n => n.toLowerCase() === view.name.toLowerCase());

      if (alreadyExists) {
        console.log(`\n  ↩  Skipping (exists): "${view.name}"`);
        skipped++;
        continue;
      }

      console.log(`\n  + Creating: "${view.name}" (layout: ${view.layout ?? 'table'})...`);

      // a) Click "New view"
      await clickNewViewButton(page);
      await screenshot(page, `${String(created + 1).padStart(2, '0')}-after-new-view-click`);

      // b) Set layout (table is default, skip)
      if (view.layout && view.layout !== 'table') {
        await setViewLayout(page, view.layout);
        await screenshot(page, `${String(created + 1).padStart(2, '0')}-after-layout-set`);
      }

      // c) Rename the view
      await setViewName(page, view.name);
      await screenshot(page, `${String(created + 1).padStart(2, '0')}-after-rename`);

      // d) Group by
      if (view.groupBy) {
        await setGroupBy(page, view.groupBy);
        await screenshot(page, `${String(created + 1).padStart(2, '0')}-after-groupby`);
      }

      // e) Filter
      if (view.filter) {
        await setFilter(page, view.filter);
        await screenshot(page, `${String(created + 1).padStart(2, '0')}-after-filter`);
      }

      // Wait for autosave
      await page.waitForTimeout(1000);
      console.log(`  ✓  Created: "${view.name}"`);
      created++;
    }

    // ── 5. Summary ────────────────────────────────────────────────────────────
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Done.  Created: ${created}  Skipped: ${skipped}  Warnings: ${warned}`);
    if (created > 0 || skipped > 0) {
      console.log(`View: ${PROJECT_URL}`);
    }
    if (existsSync(SCREENSHOTS_DIR)) {
      console.log(`Debug screenshots: ${SCREENSHOTS_DIR}`);
    }

  } finally {
    // Disconnect but leave Edge running
    await browser.close();
    console.log('\nDisconnected from Edge (Edge remains open).');
  }
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
