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
import { execSync, spawn, spawnSync } from 'node:child_process';
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
const REAPPLY = process.argv.includes('--reapply'); // re-apply layout/filter to existing views

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

  await waitForCDP(60_000);
  console.log('  Edge CDP ready.');
}

// ── Screenshot helper ─────────────────────────────────────────────────────────

async function screenshot(page, name) {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const p = path.join(SCREENSHOTS_DIR, `${name}.png`);
  // timeout prevents hanging on slow font/resource loads; animations:disabled speeds it up
  await page.screenshot({ path: p, fullPage: false, timeout: 10_000, animations: 'disabled' })
    .catch(err => console.warn(`  [screenshot failed] ${name}: ${err.message}`));
  console.log(`  [screenshot] ${p}`);
}

// ── GitHub Projects UI helpers ────────────────────────────────────────────────

async function getOrOpenProjectPage(browser) {
  let page;

  // Find an existing context that might have github.com open
  outer: for (const ctx of browser.contexts()) {
    for (const pg of ctx.pages()) {
      if (pg.url().includes('github.com')) {
        page = pg;
        break outer;
      }
    }
  }

  if (!page) {
    const ctx = browser.contexts()[0] ?? await browser.newContext();
    page = await ctx.newPage();
  }

  await page.goto(PROJECT_URL, { waitUntil: 'load', timeout: 60_000 });

  // Dismiss any open modal/overlay that may have been left open from a previous session
  try {
    await page.keyboard.press('Escape');
    await delay(300);
  } catch { /* ignore */ }

  // Wait for the Projects v2 view tab strip to mount.
  // GitHub Projects keeps persistent connections so networkidle never fires — wait for tabs.
  // The tab strip lives inside the prc-navigation component.
  await page.waitForSelector(
    '[role="tab"]:not([aria-label*="Overlay" i]):not([class*="Overlay" i])',
    { timeout: 30_000 }
  );

  return page;
}

async function getExistingViewNames(page) {
  // Use evaluate to walk the DOM directly — allTextContents() only queries visible tabs
  // when GitHub uses CSS overflow to hide scrolled-off ones.
  const tabs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="tab"]'))
      .map(el => el.textContent.replace(/^\+\s*/, '').trim())
  );
  return tabs.filter(t => t && t.toLowerCase() !== 'new view');
}

async function dismissAllDialogs(page) {
  // Dismiss any modal confirmation dialogs (Save/Discard filter prompts, etc.)
  // Try Cancel first, then Escape as a fallback
  try {
    const cancelBtn = page.locator(
      'dialog button:has-text("Cancel"), [role="dialog"] button:has-text("Cancel"), .Overlay button:has-text("Cancel")'
    ).first();
    if (await cancelBtn.isVisible({ timeout: 1000 })) {
      await cancelBtn.click();
      await page.waitForTimeout(400);
      return;
    }
  } catch { /* none */ }
  // Fallback: press Escape to close any open overlay
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } catch { /* ignore */ }
}

async function dismissWelcomeDialogs(page) {
  // "Welcome to Roadmap!" and similar first-run dialogs block subsequent interactions
  const dismissButtons = [
    () => page.getByRole('button', { name: /got it/i }),
    () => page.getByRole('button', { name: /dismiss/i }),
    () => page.locator('button:has-text("Got it")'),
  ];
  for (const sel of dismissButtons) {
    try {
      const btn = sel();
      if (await btn.isVisible({ timeout: 1000 })) {
        await btn.click();
        await page.waitForTimeout(300);
      }
    } catch { /* no dialog present */ }
  }
}

async function navigateToView1(page) {
  // Always start from View 1 (Table layout) before creating a new view to prevent
  // GitHub from inheriting the current view's layout for the newly created view
  try {
    const view1Tab = page.getByRole('tab', { name: /^view 1$/i });
    if (await view1Tab.isVisible({ timeout: 2000 })) {
      await view1Tab.click();
      await page.waitForTimeout(400);
      await dismissWelcomeDialogs(page);
    }
  } catch { /* View 1 not found — proceed anyway */ }
}

async function saveUnsavedChanges(page) {
  // GitHub shows Save/Discard buttons in the filter bar when changes are pending.
  // Clicking Save triggers a "Save filters for X?" confirmation modal — must click Save there too.

  // Step 1: is there an unsaved-filter state? (Discard button is the reliable signal)
  let hasPendingSave = false;
  try {
    const discardBtn = page.locator('button:has-text("Discard")').first();
    hasPendingSave = await discardBtn.isVisible({ timeout: 2000 });
  } catch { /* no pending save */ }

  if (!hasPendingSave) return;

  // Step 2: click the toolbar Save (not a dialog button — find it by proximity to Discard)
  try {
    // The toolbar Save button is adjacent to Discard. Use a broader locator and pick the one
    // nearest the filter bar (which has both Discard and Save side by side).
    const saveBtn = page.locator('button:has-text("Save")').first();
    await saveBtn.click();
    await page.waitForTimeout(800);
  } catch { /* unexpected */ }

  // Step 3: handle the "Save filters for X?" confirmation modal.
  // GitHub Primer renders dialogs in a portal (#__primerPortalRoot__) with a backdrop
  // that intercepts pointer events for anything outside the portal. Must scope the
  // Save button selector to the portal root — generic .last() hits the toolbar button
  // behind the backdrop and times out.
  try {
    await page.waitForSelector('#__primerPortalRoot__ button', { timeout: 3000 });
    const confirmBtn = page.locator('#__primerPortalRoot__ button:has-text("Save")').first();
    if (await confirmBtn.isVisible({ timeout: 2000 })) {
      await confirmBtn.click();
      await page.waitForTimeout(600);
    }
  } catch { /* no confirmation dialog — filter saved without secondary confirm */ }
}

async function deleteViewByName(page, viewName) {
  // Find the view URL from the tab href
  const viewUrl = await page.evaluate((name) => {
    const tab = Array.from(document.querySelectorAll('[role="tab"]'))
      .find(t => {
        const text = t.querySelector('[class*="viewNameText"]')?.textContent?.trim();
        return text === name;
      });
    return tab?.href ?? null;
  }, viewName);

  if (!viewUrl) {
    console.log(`    tab href not found for "${viewName}"`);
    return false;
  }

  await page.goto(viewUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('[role="tab"].selected', { timeout: 15_000 });
  await page.waitForTimeout(500);
  await dismissWelcomeDialogs(page);

  // The caret dropdown trigger is a hidden DIV (viewOptionsPlaceholder) that responds to
  // mouse clicks at its coordinates even when visibility:hidden. Force-click via mouse.move + click.
  const placeholder = page.locator('[class*="viewOptionsPlaceholder"]').first();
  const box = await placeholder.boundingBox().catch(() => null);
  if (!box) {
    await screenshot(page, `delete-placeholder-not-found-${viewName.replace(/\s+/g, '-')}`);
    return false;
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(600);

  // "Delete view" is in the resulting dropdown menu
  const deleteItem = page.locator('[role="menuitem"]:has-text("Delete view")');
  if (!await deleteItem.isVisible({ timeout: 3000 })) {
    await page.keyboard.press('Escape');
    await screenshot(page, `delete-option-not-found-${viewName.replace(/\s+/g, '-')}`);
    return false;
  }
  await deleteItem.click();
  await page.waitForTimeout(800);

  // GitHub shows a second confirmation dialog: "Delete view? Are you sure?" — click Delete
  const confirmBtn = page.getByRole('button', { name: /^delete$/i })
    .or(page.locator('dialog button:has-text("Delete"), [role="dialog"] button:has-text("Delete")'));
  if (await confirmBtn.isVisible({ timeout: 3000 })) {
    await confirmBtn.click();
    await page.waitForTimeout(1200);
    return true;
  }

  // If no confirmation dialog appeared, the delete may have gone through directly
  return true;
}

async function clickNewViewButton(page) {
  // GitHub Projects v2: "+ New view" is a <button> with text "New view" in the tab strip
  // (confirmed via DOM inspection — class view-navigation-module__newViewButton__*)
  const strategies = [
    () => page.getByRole('button', { name: /new view/i }),
    () => page.locator('button:has-text("New view")').first(),
    () => page.locator(':text("New view")').first(),
    () => page.getByRole('tab', { name: /new view/i }),
  ];

  for (const strategy of strategies) {
    try {
      const el = strategy();
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click();
        await page.waitForTimeout(800);
        return;
      }
    } catch { /* try next */ }
  }

  await screenshot(page, 'new-view-button-not-found');
  throw new Error('Could not find "New view" tab. See debug screenshot.');
}

async function setViewLayout(page, layout) {
  // IMPORTANT: After clicking "+ New view", GitHub shows a layout picker dropdown.
  // We MUST click an option (even Table) to dismiss it and complete view creation.
  // Returning early for 'table' leaves the dropdown open and breaks subsequent steps.

  // After a new view is created, GitHub shows layout options in a panel/popover
  // OR we need to switch layout via the toolbar
  // Try the immediate layout selector first (appears right after creating a view)
  const layoutSelectors = {
    table:   [/^table$/i],
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
    const moreBtn = page.locator('[role="tab"][aria-selected="true"] ~ button, [role="tab"][aria-selected="true"] button[aria-label*="more" i]');
    if (await moreBtn.isVisible({ timeout: 2000 })) {
      await moreBtn.click();
      await page.waitForTimeout(400);
      let found = false;
      for (const pattern of patterns) {
        const item = page.getByRole('menuitem', { name: pattern });
        if (await item.isVisible({ timeout: 2000 })) {
          await item.click();
          await page.waitForTimeout(400);
          found = true;
          break;
        }
      }
      // Always close the menu if we opened it and didn't find the option
      if (!found) await page.keyboard.press('Escape');
      if (found) return;
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

  // Dismiss any lingering confirmation dialogs before touching the filter bar
  try {
    const cancelBtn = page.locator('dialog button:has-text("Cancel"), [role="dialog"] button:has-text("Cancel")').first();
    if (await cancelBtn.isVisible({ timeout: 800 })) await cancelBtn.click();
  } catch { /* none */ }

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

    // ── 3.5. Delete ghost views (tabs whose names don't match any VIEWS spec) ──
    const expectedNameSet = new Set([
      'view 1', // built-in default — never delete
      ...VIEWS.map(v => v.name.toLowerCase()),
    ]);
    const ghostViews = existingNames.filter(n => !expectedNameSet.has(n.toLowerCase()));
    if (ghostViews.length > 0) {
      console.log(`\n3.5. Cleaning up ${ghostViews.length} ghost view(s): [${ghostViews.join(', ')}]`);
      for (const ghost of ghostViews) {
        const deleted = await deleteViewByName(page, ghost);
        console.log(deleted ? `  ✓  Deleted: "${ghost}"` : `  !  Could not delete: "${ghost}" — remove manually`);
        await page.waitForTimeout(500);
      }
      // Refresh tab list after deletions
      await page.waitForTimeout(800);
    }

    // ── 3.6. Detect and fix layout mismatches via GraphQL ─────────────────────
    // GitHub's API exposes the current layout of each view. Compare against spec
    // and delete any views whose layout doesn't match — the create path will recreate them.
    try {
      const layoutQuery = `query { user(login: "${owner}") { projectV2(number: ${projectNumber}) { views(first: 20) { nodes { name layout } } } } }`;
      // Use spawnSync with args array to avoid shell quoting issues on Windows
      const layoutResult = spawnSync('gh', ['api', 'graphql', '-f', `query=${layoutQuery}`], { encoding: 'utf8' });
      if (layoutResult.status !== 0) throw new Error(layoutResult.stderr || 'gh api graphql failed');
      const layoutRaw = layoutResult.stdout;
      const layoutData = JSON.parse(layoutRaw);
      const ghViews = layoutData.data.user.projectV2.views.nodes;
      const ghLayoutMap = Object.fromEntries(ghViews.map(v => [v.name, v.layout]));
      const specToGhLayout = { table: 'TABLE_LAYOUT', board: 'BOARD_LAYOUT', roadmap: 'ROADMAP_LAYOUT' };

      const layoutMismatches = VIEWS.filter(v => {
        const ghLayout = ghLayoutMap[v.name];
        if (!ghLayout) return false; // view doesn't exist yet — create path will handle it
        const expected = specToGhLayout[v.layout ?? 'table'];
        return ghLayout !== expected;
      });

      if (layoutMismatches.length > 0) {
        console.log(`\n3.6. Fixing ${layoutMismatches.length} layout mismatch(es): [${layoutMismatches.map(v => v.name).join(', ')}]`);
        for (const v of layoutMismatches) {
          const actual = ghLayoutMap[v.name];
          const expected = specToGhLayout[v.layout ?? 'table'];
          console.log(`  Layout mismatch: "${v.name}" — actual: ${actual}, expected: ${expected} — deleting to recreate`);
          const deleted = await deleteViewByName(page, v.name);
          if (deleted) {
            // Remove from existingNames so the create path handles it
            const idx = existingNames.findIndex(n => n.toLowerCase() === v.name.toLowerCase());
            if (idx !== -1) existingNames.splice(idx, 1);
            console.log(`  ✓  Deleted: "${v.name}" (will be recreated with correct layout)`);
          } else {
            console.log(`  !  Could not delete: "${v.name}" — manual fix needed`);
          }
          await page.waitForTimeout(500);
        }
        await page.waitForTimeout(800);
      }
    } catch (e) {
      console.warn(`  WARNING: Layout mismatch check skipped (${e.message}) — run views:fix to re-apply`);
    }

    // ── 4. Create each view ─────────────────────────────────────────────────
    let created = 0;
    let skipped = 0;
    let warned = 0;

    for (const view of VIEWS) {
      const alreadyExists = existingNames.some(n => n.toLowerCase() === view.name.toLowerCase());

      if (alreadyExists && !REAPPLY) {
        console.log(`\n  ↩  Skipping (exists): "${view.name}" — use --reapply to re-apply settings`);
        skipped++;
        continue;
      }

      if (alreadyExists && REAPPLY) {
        console.log(`\n  ~ Reapplying settings to existing view: "${view.name}"...`);

        // Dismiss any dialogs left open by the previous iteration BEFORE navigating
        await dismissAllDialogs(page);

        // Click the existing tab to make it active
        try {
          await page.getByRole('tab', { name: new RegExp(view.name, 'i') }).click();
          await page.waitForTimeout(700);
          // Dismiss again in case a dialog appeared during tab navigation
          await dismissAllDialogs(page);
          await dismissWelcomeDialogs(page);
        } catch { /* continue */ }

        // Layouts are persistent — don't try to re-set them (avoids accidentally opening
        // the "..." menu and leaving it open or triggering unintended actions)
        if (view.filter) {
          await setFilter(page, view.filter);
          await saveUnsavedChanges(page);
        }
        await screenshot(page, `reapply-${view.name.replace(/[^a-z0-9]/gi, '-')}`);
        skipped++;
        continue;
      }

      console.log(`\n  + Creating: "${view.name}" (layout: ${view.layout ?? 'table'})...`);

      // Navigate to View 1 first so GitHub creates new view in Table layout by default,
      // not inheriting Roadmap or Board layout from the currently active view
      await navigateToView1(page);

      // a) Click "New view"
      await clickNewViewButton(page);
      await screenshot(page, `${String(created + 1).padStart(2, '0')}-after-new-view-click`);

      // b) Select layout from picker — always required to dismiss the dropdown and create the view
      await setViewLayout(page, view.layout ?? 'table');
      await screenshot(page, `${String(created + 1).padStart(2, '0')}-after-layout-set`);

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
        await saveUnsavedChanges(page);
        await screenshot(page, `${String(created + 1).padStart(2, '0')}-after-filter`);
      }

      // Dismiss any welcome/onboarding dialogs before moving on
      await dismissWelcomeDialogs(page);
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
