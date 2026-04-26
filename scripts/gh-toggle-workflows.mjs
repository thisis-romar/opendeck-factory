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

const HEADED  = process.argv.includes('--headed');
const DRY_RUN = process.argv.includes('--dry-run');

// ── Workflow definitions ──────────────────────────────────────────────────────

// The Auto-add workflow filter box only accepts issue/PR field qualifiers.
// repo: is handled by the separate repo-selector pill in the UI, not the text filter.
// For multi-repo coverage, create separate Auto-add workflows per repo in the UI.
const AUTO_ADD_FILTER = 'is:issue,pr';

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
 * Configure the Auto-add workflow: enable it and set the filter text.
 * The filter input is disabled in viewing mode — must click Edit first.
 * Note: the UI also shows a repo-selector pill. We update only the text filter;
 * the repo can be changed manually if needed.
 */
async function configureAutoAddFilter(page, filter) {
  // Navigate to Auto-add to project in the sidebar
  const autoAddLink = page.locator('text=Auto-add to project').first();
  if (await autoAddLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await autoAddLink.click();
    await delay(800);
  }
  await screenshot(page, 'autoadd-open');

  // Must be in Edit mode for the filter input to be enabled
  const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit")').first();
  const filterInput = page.locator('input[aria-label*="filter" i], input[placeholder*="filter" i]').first();
  const isEditable = await filterInput.isEnabled({ timeout: 1000 }).catch(() => false);

  if (!isEditable) {
    console.log('  Entering Edit mode to unlock filter input...');
    if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editBtn.click();
      await delay(1000);
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

  // Save
  const saveBtn = page.locator('button:has-text("Save and turn on workflow"), button:has-text("Save")').first();
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
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
    return;
  }

  console.log('\n1. Setting up Edge CDP connection...');
  await launchEdgeWithCDP(WORKFLOWS_URL);

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  console.log('  Connected to Edge via CDP.');

  try {
    const page = await getOrOpenWorkflowsPage(browser);
    await screenshot(page, '00-workflows-page');

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

    console.log('\n3. Configuring Auto-add filter...');
    await configureAutoAddFilter(page, AUTO_ADD_FILTER);
    await screenshot(page, '02-after-autoadd');

    console.log('\nDone.');
    console.log(`Debug screenshots: ${SCREENSHOTS_DIR}`);
  } finally {
    await browser.close();
    console.log('Disconnected from Edge (Edge remains open).');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
