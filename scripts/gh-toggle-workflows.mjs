#!/usr/bin/env node
/**
 * Enable GitHub Projects v2 built-in workflows and configure the Auto-add workflow.
 * The Projects v2 workflows API is not exposed in GraphQL — this script drives the
 * web UI via Playwright + CDP-attach to an existing Edge session.
 *
 * Built-in workflows enabled:
 *   1. Item closed → Status: Done
 *   2. Pull request merged → Status: Done
 *   3. Item added to project → Status: Todo
 *   4. Auto-archive items (14 days in Done)
 *   5. Auto-add to project (sub-issues)
 *
 * Auto-add workflow configured with filter:
 *   is:issue,pr repo:thisis-romar/opendeck-factory
 *                repo:thisis-romar/stream-deck-catalog
 *                repo:thisis-romar/opendeck-planning
 *
 * Requires: Edge running (or restartable), user already logged into GitHub.
 * Run: node scripts/gh-toggle-workflows.mjs [--headed] [--dry-run]
 */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CDP_PORT,
  launchEdgeWithCDP, screenshot as cdpScreenshot, delay,
} from './lib/cdp.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const ids = JSON.parse(readFileSync(path.join(ROOT, '.github', 'project-ids.json'), 'utf8'));
const config = JSON.parse(readFileSync(path.join(ROOT, 'data', 'project-items.json'), 'utf8'));

const { owner } = config.project;
const { projectNumber } = ids;

const WORKFLOWS_URL = `https://github.com/users/${owner}/projects/${projectNumber}/workflows`;
const SCREENSHOTS_DIR = path.join(ROOT, '.gh-workflows-debug');

const HEADED       = process.argv.includes('--headed');
const DRY_RUN      = process.argv.includes('--dry-run');
const PROBE_AUTOADD = process.argv.includes('--probe-autoadd');

// ── Workflow definitions ──────────────────────────────────────────────────────

// The Auto-add filter box accepts issue/PR field qualifiers only.
// Multi-repo coverage is set via the repo dropdown pill inside the workflow — NOT via
// separate repo: qualifiers in the text filter. All three repos share one workflow
// entry; the pill becomes "3 repositories" after this script runs.
const AUTO_ADD_FILTER = 'is:issue,pr';

// Additional repos to include in the Auto-add repo pill (opendeck-factory is pre-selected).
const EXTRA_REPOS = ['stream-deck-catalog', 'opendeck-planning'];

// Only workflows that are currently OFF (confirmed from screenshots 2026-04-26).
// Already ON: Auto-add sub-issues, Auto-close issue, Item added to project,
//             Item closed, Pull request linked to issue, Pull request merged.
const BUILTIN_WORKFLOWS = [
  'Auto-archive items',
  'Auto-add to project',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function screenshot(page, name) {
  return cdpScreenshot(page, name, SCREENSHOTS_DIR);
}

async function getOrOpenWorkflowsPage(browser) {
  let page;
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
  await page.goto(WORKFLOWS_URL, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForSelector('h2, [data-testid="workflows"]', { timeout: 30_000 }).catch(() => {});
  return page;
}

/**
 * GitHub Workflows UI (2026): workflows open in "viewing mode" by default.
 * - Already-ON workflows: show a blue "On" indicator + "Edit" button in top-right.
 * - OFF workflows: show only "Edit" button; toggle is only revealed after clicking Edit.
 *
 * Flow: click sidebar card → check for "On" indicator → if absent, click Edit →
 *       find toggle → turn on → save.
 *
 * Returns 'enabled', 'already-enabled', or 'not-found'.
 */
async function enableWorkflow(page, workflowName) {
  // Click the card in the sidebar
  const card = page.locator(`text="${workflowName}"`).first()
    .or(page.locator(`text=${workflowName}`).first());
  if (!await card.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.warn(`  [warn] Workflow "${workflowName}" not found in sidebar`);
    return 'not-found';
  }

  await card.click();
  await delay(1000);
  await screenshot(page, `workflow-${workflowName.replace(/\s+/g, '-').toLowerCase()}-open`);

  // Check if already ON (viewing-mode ON shows "On" text near top-right)
  const onIndicator = page.locator('button:has-text("On"), [data-testid*="toggle"][aria-checked="true"]').first()
    .or(page.locator('[role="switch"][aria-checked="true"]').first());
  if (await onIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log(`    Already on: "${workflowName}"`);
    return 'already-enabled';
  }

  // Need to enter Edit mode to reveal the toggle
  const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit")').first();
  if (!await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.warn(`  [warn] Edit button not found for "${workflowName}"`);
    return 'not-found';
  }

  console.log(`    Clicking Edit for "${workflowName}"...`);
  await editBtn.click();
  await delay(1000);

  // In edit mode, the On/Off toggle should now be visible
  const toggle = page.locator('[role="switch"], input[type="checkbox"]').first();
  if (await toggle.isVisible({ timeout: 3000 }).catch(() => false)) {
    const checked = await toggle.isChecked().catch(() => false);
    if (!checked) {
      await toggle.click();
      await delay(600);
      console.log(`    Toggled ON.`);
    } else {
      console.log(`    Toggle already checked in edit mode.`);
    }
  } else {
    console.warn(`  [warn] Toggle not found in edit mode for "${workflowName}"`);
  }

  // Save
  const saveBtn = page.locator('button:has-text("Save and turn on workflow"), button:has-text("Save")').first();
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    await delay(800);
    console.log(`    Saved.`);
  }

  await screenshot(page, `workflow-${workflowName.replace(/\s+/g, '-').toLowerCase()}-saved`);
  return 'enabled';
}

/**
 * Resolve the repo dropdown pill in the Auto-add edit view.
 * The pill is a button showing the currently-selected repo name.
 * Returns the pill locator, or null if not found.
 */
async function findRepoPill(page) {
  // Check all three known repo names (pill label = whichever repo is currently selected)
  const candidates = [
    'button:has-text("opendeck-factory")',
    'button:has-text("stream-deck-catalog")',
    'button:has-text("opendeck-planning")',
  ];
  for (const sel of candidates) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 800 }).catch(() => false)) return el;
  }
  return null;
}

/**
 * In the Auto-add edit view, click the repo pill and select a specific repo.
 * The picker is single-select — clicking a repo REPLACES the current selection.
 * Only call this when creating a new/duplicate workflow to change its repo.
 * Returns true on success.
 */
async function selectRepoInPill(page, repoName) {
  const pill = await findRepoPill(page);
  if (!pill) {
    console.warn(`  [warn] repo pill not found — cannot select ${repoName}`);
    return false;
  }

  await pill.click({ force: true });
  await delay(600);
  await screenshot(page, `repo-picker-${repoName}`);

  // Wait for Primer portal with the repo list
  await page.waitForSelector('#__primerPortalRoot__', { timeout: 5_000 })
    .catch(() => console.warn('  [warn] portal not found after clicking repo pill'));

  // Use the search input (placeholder: "Items will be filtered as you type")
  const search = page.locator(
    '#__primerPortalRoot__ input[type="text"],' +
    '#__primerPortalRoot__ input[placeholder*="filter" i],' +
    '#__primerPortalRoot__ input[placeholder*="type" i]'
  ).first();
  if (await search.isVisible({ timeout: 1000 }).catch(() => false)) {
    await search.fill(repoName);
    await delay(500);
  }

  // Items are plain <li> / <button> elements — confirmed by probe (no aria-checked)
  const itemCandidates = [
    `#__primerPortalRoot__ li:has-text("${repoName}")`,
    `#__primerPortalRoot__ button:has-text("${repoName}")`,
    `#__primerPortalRoot__ [role="option"]:has-text("${repoName}")`,
  ];
  let item = null;
  for (const sel of itemCandidates) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) { item = el; break; }
  }
  if (!item) {
    await page.keyboard.press('Escape');
    console.warn(`  [warn] repo "${repoName}" not found in picker`);
    return false;
  }

  await item.click({ force: true });
  await delay(600);
  console.log(`    Selected repo: ${repoName}`);
  return true;
}

/**
 * Duplicate the existing "Auto-add to project" workflow and configure it for a new repo.
 * Each repo needs its own Auto-add workflow instance (the repo picker is single-select).
 * Returns true on success, false if the kebab/Duplicate option isn't found.
 */
async function createAutoAddForRepo(page, repoName, filter) {
  console.log(`  Creating Auto-add for ${repoName}...`);

  // Fresh navigation so the sidebar is in a predictable state
  await page.goto(WORKFLOWS_URL, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await delay(1500);

  // Hover the Auto-add sidebar item to reveal the "..." kebab button
  const autoAddItem = page.locator(
    'li:has-text("Auto-add to project"), [role="listitem"]:has-text("Auto-add to project")'
  ).first();
  if (!await autoAddItem.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.warn('  [warn] "Auto-add to project" sidebar item not found');
    return false;
  }
  await autoAddItem.hover();
  await delay(500);
  await screenshot(page, `autoadd-item-hover-${repoName}`);

  // The kebab "..." is the last button inside the list item (appears on hover)
  const kebab = autoAddItem.locator('button').last();
  if (!await kebab.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.warn('  [warn] kebab "..." button not visible after hover');
    await screenshot(page, `autoadd-kebab-missing-${repoName}`);
    return false;
  }

  await kebab.click({ force: true });
  await delay(600);
  await screenshot(page, `autoadd-kebab-menu-${repoName}`);

  // Find "Duplicate" in the context menu — may render inline or in Primer portal
  const dupCandidates = [
    '[role="menuitem"]:has-text("Duplicate")',
    '#__primerPortalRoot__ [role="menuitem"]:has-text("Duplicate")',
    'button:has-text("Duplicate")',
    '#__primerPortalRoot__ button:has-text("Duplicate")',
  ];
  let dupBtn = null;
  for (const sel of dupCandidates) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) { dupBtn = el; break; }
  }
  if (!dupBtn) {
    await page.keyboard.press('Escape');
    await screenshot(page, `autoadd-no-duplicate-${repoName}`);
    console.warn(`  [warn] "Duplicate" not in kebab menu — inspect autoadd-kebab-menu-${repoName}.png`);
    return false;
  }

  // Check for disabled state BEFORE clicking — GitHub free plan caps at 1 Auto-add workflow.
  // The "Duplicate workflow" option is visible but greyed out when the limit is reached.
  const isDisabled = await dupBtn.evaluate(el =>
    el.getAttribute('aria-disabled') === 'true' ||
    el.closest('[aria-disabled="true"]') !== null ||
    el.hasAttribute('disabled') ||
    getComputedStyle(el).pointerEvents === 'none'
  ).catch(() => false);

  if (isDisabled) {
    await page.keyboard.press('Escape');
    console.warn(`  [!] "Duplicate workflow" is disabled — GitHub plan limit reached`);
    console.warn(`      The free plan allows only 1 Auto-add workflow per project.`);
    console.warn(`      To unlock: upgrade at github.com/settings/billing, then re-run npm run workflows:toggle`);
    return false;
  }

  await dupBtn.click({ force: true });
  await delay(1500);
  await screenshot(page, `autoadd-duplicated-${repoName}`);
  console.log(`    Duplicated — configuring for ${repoName}`);

  // Select the target repo in the pill (replaces the source repo)
  const repoSelected = await selectRepoInPill(page, repoName);
  if (!repoSelected) return false;

  // Ensure filter matches (duplicate copies the filter, but verify)
  const filterInput = page.locator(
    'input[aria-label*="filter" i], input[placeholder*="filter" i]'
  ).first();
  if (await filterInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    const current = await filterInput.inputValue().catch(() => '');
    if (current !== filter) {
      await filterInput.fill('');
      await filterInput.fill(filter);
      await delay(400);
    }
  }

  // Enable the on/off toggle if not already on
  const toggle = page.locator('[role="switch"], input[type="checkbox"]').first();
  if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
    const on = await toggle.isChecked().catch(() => false);
    if (!on) { await toggle.click(); await delay(600); }
  }

  await screenshot(page, `autoadd-new-${repoName}-ready`);

  // Save — try the specific labels in order
  const saveCandidates = [
    'button:has-text("Save and turn on workflow")',
    'button:has-text("Save workflow")',
    'button:has-text("Save")',
  ];
  for (const sel of saveCandidates) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click({ force: true });
      await delay(1000);
      console.log(`  ✓ Auto-add for ${repoName} saved`);
      return true;
    }
  }

  console.warn(`  [warn] Save button not found for ${repoName}`);
  return false;
}

/**
 * Open the Auto-add edit view, click the repo pill, screenshot the open dropdown,
 * then Discard without saving. Used to verify selectors before running the full flow.
 */
async function probeAutoAddDropdown(page) {
  // Navigate fresh to the workflows page so the SPA is fully settled
  await page.goto(
    `https://github.com/users/thisis-romar/projects/4/workflows`,
    { waitUntil: 'load', timeout: 60_000 },
  );
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await delay(1500);

  // Click the Auto-add sidebar link — force:true bypasses pointer-event interception
  const autoAddLink = page.locator('text=Auto-add to project').first();
  if (await autoAddLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await autoAddLink.click({ force: true }); await delay(1200);
  }
  // Enter edit mode
  const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit")').first();
  if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await editBtn.click({ force: true }); await delay(1200);
  }
  await screenshot(page, 'probe-autoadd-edit-mode');

  const pill = await findRepoPill(page);
  if (pill) {
    await pill.click();
    await delay(800);
    await screenshot(page, 'probe-autoadd-dropdown');
    // Dump visible text in portal for debugging
    const portalText = await page.locator('#__primerPortalRoot__').innerText().catch(() => '(portal not found)');
    console.log('  Portal content preview:\n' + portalText.slice(0, 400));
  } else {
    console.warn('  [probe] repo pill not found — check probe-autoadd-edit-mode.png');
  }

  // Discard (do NOT save anything)
  await page.keyboard.press('Escape');
  await delay(300);
  const discard = page.locator('button:has-text("Discard")').first();
  if (await discard.isVisible({ timeout: 2000 }).catch(() => false)) {
    await discard.click(); await delay(800);
  }

  // Also probe the kebab "..." menu to verify Duplicate is available
  console.log('  Probing kebab menu on Auto-add sidebar item...');
  await page.goto(WORKFLOWS_URL, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await delay(1000);
  const sidebarItem = page.locator(
    'li:has-text("Auto-add to project"), [role="listitem"]:has-text("Auto-add to project")'
  ).first();
  if (await sidebarItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sidebarItem.hover();
    await delay(500);
    await screenshot(page, 'probe-kebab-hover');
    const kebab = sidebarItem.locator('button').last();
    if (await kebab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await kebab.click({ force: true });
      await delay(600);
      await screenshot(page, 'probe-kebab-menu');
      // Menu may render inline or in a portal — capture any visible menuitem text
      const menuItems = await page.locator('[role="menuitem"]').allInnerTexts().catch(() => []);
      const menuText = menuItems.length ? menuItems.join('\n') : '(no [role=menuitem] found)';
      console.log('  Kebab menu items:\n' + menuText.slice(0, 400));
      await page.keyboard.press('Escape');
    } else {
      console.warn('  [probe] kebab button not visible after hover — check probe-kebab-hover.png');
    }
  }

  console.log(`\n  Screenshots saved to ${SCREENSHOTS_DIR}`);
  console.log('  Key files: probe-autoadd-dropdown.png, probe-kebab-menu.png');
}

/**
 * Configure the Auto-add workflow: enable it and set the filter text.
 * The filter input is disabled in viewing mode — must click Edit first.
 * After setting the filter, also ensures the EXTRA_REPOS are selected in the repo pill.
 */
async function configureAutoAddFilter(page, filter) {
  // Navigate to Auto-add to project in the sidebar — force:true bypasses any pointer intercept
  const autoAddLink = page.locator('text=Auto-add to project').first();
  if (await autoAddLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await autoAddLink.click({ force: true });
    await delay(1000);
  }
  await screenshot(page, 'autoadd-open');

  // Must be in Edit mode for the filter input to be enabled
  const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit")').first();
  const filterInput = page.locator('input[aria-label*="filter" i], input[placeholder*="filter" i]').first();
  const isEditable = await filterInput.isEnabled({ timeout: 1000 }).catch(() => false);

  if (!isEditable) {
    console.log('  Entering Edit mode to unlock filter input...');
    if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editBtn.click({ force: true });
      await delay(1200);
    }
  }

  // Enable the toggle while in edit mode (if not already on)
  const toggle = page.locator('[role="switch"], input[type="checkbox"]').first();
  if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
    const checked = await toggle.isChecked().catch(() => false);
    if (!checked) {
      await toggle.click();
      await delay(600);
      console.log('  Auto-add toggle turned ON.');
    }
  }

  // Set the filter text
  if (!await filterInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.warn('  [warn] Filter input not found — update manually at the Workflows page.');
    return false;
  }

  await filterInput.fill('');
  await filterInput.fill(filter);
  await delay(400);
  await screenshot(page, 'autoadd-filter-set');

  // Save — probe confirmed label is "Save workflow" (not "Save and turn on workflow")
  const saveBtn = page.locator(
    'button:has-text("Save and turn on workflow"), button:has-text("Save workflow"), button:has-text("Save")'
  ).first();
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click({ force: true });
    await delay(800);
    console.log(`  Auto-add filter saved: ${filter}`);
    return true;
  }

  console.warn('  [warn] Save button not found — filter may not have been saved.');
  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('gh-toggle-workflows — OpenDeck Project #' + projectNumber);
  console.log('Workflows URL: ' + WORKFLOWS_URL);
  if (DRY_RUN) {
    console.log('\nDRY RUN — no changes will be made');
    console.log('Would enable:', BUILTIN_WORKFLOWS.join(', '));
    console.log('Auto-add filter:', AUTO_ADD_FILTER);
    console.log('Extra repos for pill:', EXTRA_REPOS.join(', '));
    return;
  }

  console.log('\n1. Setting up Edge CDP connection...');
  await launchEdgeWithCDP(WORKFLOWS_URL);

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  console.log('  Connected to Edge via CDP.');

  try {
    const page = await getOrOpenWorkflowsPage(browser);
    await screenshot(page, '00-workflows-page');

    if (PROBE_AUTOADD) {
      console.log('\nPROBE MODE — opening repo dropdown for inspection (no changes saved)...');
      await probeAutoAddDropdown(page);
      return;
    }

    console.log('\n2. Enabling built-in workflows...');
    let enabled = 0;
    let alreadyOn = 0;

    for (const wf of BUILTIN_WORKFLOWS) {
      console.log(`  → "${wf}"`);
      // Go back to workflows list if needed
      if (!page.url().includes('/workflows')) {
        await page.goto(WORKFLOWS_URL, { waitUntil: 'load', timeout: 30_000 });
        await delay(500);
      }
      const result = await enableWorkflow(page, wf);
      if (result === 'enabled') enabled++;
      else if (result === 'already-enabled') alreadyOn++;
      // Return to the workflows list
      await page.goto(WORKFLOWS_URL, { waitUntil: 'load', timeout: 30_000 });
      await delay(500);
    }

    console.log(`\n  Result: ${enabled} enabled, ${alreadyOn} already on`);
    await screenshot(page, '01-after-workflows');

    console.log('\n3. Configuring Auto-add filter for opendeck-factory...');
    await page.goto(WORKFLOWS_URL, { waitUntil: 'load', timeout: 30_000 });
    await delay(500);
    await configureAutoAddFilter(page, AUTO_ADD_FILTER);
    await screenshot(page, '02-after-autoadd');

    console.log('\n4. Creating Auto-add workflows for extra repos...');
    for (const repo of EXTRA_REPOS) {
      console.log(`\n  → ${repo}`);
      const ok = await createAutoAddForRepo(page, repo, AUTO_ADD_FILTER);
      if (!ok) {
        console.warn(`  [warn] Auto-add for ${repo} may need manual setup — check screenshots`);
      }
    }
    await page.goto(WORKFLOWS_URL, { waitUntil: 'load', timeout: 30_000 });
    await delay(500);
    await screenshot(page, '03-after-extra-repos');

    console.log('\nDone.');
    console.log(`Debug screenshots: ${SCREENSHOTS_DIR}`);
  } finally {
    await browser.close();
    console.log('Disconnected from Edge (Edge remains open).');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
