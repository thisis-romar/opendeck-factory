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

const AUTO_ADD_FILTER = [
  'is:issue,pr',
  'repo:thisis-romar/opendeck-factory',
  'repo:thisis-romar/stream-deck-catalog',
  'repo:thisis-romar/opendeck-planning',
].join(' ');

// GitHub's built-in workflow names (match what appears in the UI)
const BUILTIN_WORKFLOWS = [
  'Item closed',
  'Pull request merged',
  'Item added to project',
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
 * Click a workflow card to open it, then enable it if currently disabled.
 * Returns 'enabled', 'already-enabled', or 'not-found'.
 */
async function enableWorkflow(page, workflowName) {
  // Find the card by heading text
  const card = page.locator(`text=${workflowName}`).first();
  if (!await card.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.warn(`  [warn] Workflow "${workflowName}" not found in UI`);
    return 'not-found';
  }

  await card.click();
  await delay(800);
  await screenshot(page, `workflow-${workflowName.replace(/\s+/g, '-').toLowerCase()}-open`);

  // Look for a toggle or enable button
  const enableBtn = page.locator('button:has-text("Enable"), button[aria-label*="enable" i]').first();
  const toggleOn  = page.locator('input[type="checkbox"][aria-label*="enable" i], [role="switch"]').first();

  if (await enableBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log(`    Clicking Enable button for "${workflowName}"...`);
    await enableBtn.click();
    await delay(600);
    return 'enabled';
  }

  if (await toggleOn.isVisible({ timeout: 2000 }).catch(() => false)) {
    const checked = await toggleOn.isChecked().catch(() => false);
    if (!checked) {
      console.log(`    Toggling ON "${workflowName}"...`);
      await toggleOn.click();
      await delay(600);
      return 'enabled';
    }
    console.log(`    Already enabled: "${workflowName}"`);
    return 'already-enabled';
  }

  // Check if a "Workflow is on" / "Workflow is off" indicator exists
  const isOn = await page.locator('text=/workflow is on/i').isVisible({ timeout: 2000 }).catch(() => false);
  if (isOn) {
    console.log(`    Already on: "${workflowName}"`);
    return 'already-enabled';
  }

  console.warn(`  [warn] Could not find enable control for "${workflowName}"`);
  return 'not-found';
}

/**
 * Find and configure the Auto-add workflow filter, then save.
 * GitHub's Auto-add workflow has a text input for the filter query.
 */
async function configureAutoAddFilter(page, filter) {
  // Navigate to the Auto-add workflow card (may already be there)
  const autoAddLink = page.locator('text=Auto-add to project').first();
  if (await autoAddLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await autoAddLink.click();
    await delay(800);
  }

  await screenshot(page, 'autoadd-open');

  // Find the filter text input
  const filterInput = page.locator('input[placeholder*="filter" i], input[aria-label*="filter" i], input[name="filter"]').first();
  if (!await filterInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.warn('  [warn] Auto-add filter input not found — may need manual configuration');
    return false;
  }

  // Clear and set
  await filterInput.fill('');
  await filterInput.fill(filter);
  await delay(400);

  // Save
  const saveBtn = page.locator(
    '#__primerPortalRoot__ button:has-text("Save"), button:has-text("Save workflow"), button:has-text("Save")'
  ).first();
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    await delay(600);
    console.log(`    Auto-add filter saved: ${filter}`);
    return true;
  }

  console.warn('  [warn] Save button not found for Auto-add filter');
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
