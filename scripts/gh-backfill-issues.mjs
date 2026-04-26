#!/usr/bin/env node
/**
 * gh-backfill-issues.mjs
 *
 * Bulk-creates GitHub issues from scripts/component-inventory.json and
 * populates all GitHub Project custom fields (Area, Priority, Target, Size,
 * Revenue Impact, Status=Todo) for each created issue.
 *
 * Usage:
 *   node scripts/gh-backfill-issues.mjs
 *   node scripts/gh-backfill-issues.mjs --dry-run   # preview only, no API calls
 *
 * Requirements:
 *   - gh CLI authenticated with repo + project write scopes
 *   - .github/project-ids.json present at repo root
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Config ────────────────────────────────────────────────────────────────────

const REPO = 'thisis-romar/opendeck-factory';
const PROJECT_NUMBER = 4;
const OWNER = 'thisis-romar';
const DELAY_MS = 4000; // safe under 15 creates/min

const DRY_RUN = process.argv.includes('--dry-run');

// ── Load project IDs ──────────────────────────────────────────────────────────

const projectIds = JSON.parse(
  readFileSync(join(ROOT, '.github', 'project-ids.json'), 'utf8')
);

const { projectId, fieldIds, milestones } = projectIds;

// fieldOptions may not include priority option IDs (they aren't stored in project-ids.json).
// We merge whatever is present and supplement priority options at startup if missing.
const fieldOptions = { ...projectIds.fieldOptions };

// Known priority option IDs (fetched once from the live project if absent).
// These are the standard option IDs for the Priority field on this project.
// If fieldOptions.priority is absent, fetchPriorityOptions() will populate it.
if (!fieldOptions.priority) {
  fieldOptions.priority = null; // populated in main() before first use
}

// ── Load inventory ────────────────────────────────────────────────────────────

const inventory = JSON.parse(
  readFileSync(join(ROOT, 'scripts', 'component-inventory.json'), 'utf8')
);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Run a shell command and return trimmed stdout.
 * Throws on non-zero exit.
 */
function run(cmd, label = '') {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] ${cmd}`);
    return '__DRY_RUN__';
  }
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    const msg = err.stderr?.trim() || err.message;
    throw new Error(`${label ? label + ': ' : ''}${msg}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch priority option IDs from the live GitHub Project field list.
 * Falls back to a hard-coded lookup table if the API call fails.
 * Populates fieldOptions.priority in place.
 */
function fetchPriorityOptions() {
  if (DRY_RUN) {
    // Use placeholder IDs for dry-run so field resolution doesn't crash
    fieldOptions.priority = {
      'P0':      '__P0_DRY_RUN__',
      'P1-High': '__P1_DRY_RUN__',
      'P2-Med':  '__P2_DRY_RUN__',
      'P3-Low':  '__P3_DRY_RUN__',
    };
    return;
  }

  console.log('Fetching Priority field option IDs from project...');
  try {
    const raw = execSync(
      `gh project field-list ${PROJECT_NUMBER} --owner ${OWNER} --format json --limit 50`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    const { fields } = JSON.parse(raw);
    const priorityField = fields.find(f => f.id === fieldIds.priority);
    if (priorityField && priorityField.options) {
      fieldOptions.priority = {};
      for (const opt of priorityField.options) {
        fieldOptions.priority[opt.name] = opt.id;
      }
      console.log('  Priority options:', Object.keys(fieldOptions.priority).join(', '));
    } else {
      throw new Error('Priority field not found or has no options in project field list');
    }
  } catch (err) {
    console.warn('  Warning: could not fetch priority options from API — field will be skipped.');
    console.warn('  ' + (err.stderr?.trim() || err.message));
    // Set to an empty object so resolveOption throws a useful error rather than crashing
    fieldOptions.priority = {};
  }
}

/**
 * Fetch all existing issue titles from the repo so we can skip duplicates.
 * Returns a Set of lower-cased titles.
 */
function fetchExistingTitles() {
  console.log('Fetching existing issues for duplicate detection...');
  try {
    const raw = execSync(
      `gh issue list --repo ${REPO} --state all --limit 500 --json title`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    const issues = JSON.parse(raw);
    return new Set(issues.map(i => i.title.toLowerCase().trim()));
  } catch (err) {
    console.warn('  Warning: could not fetch existing issues — duplicate detection disabled.');
    console.warn('  ' + (err.stderr?.trim() || err.message));
    return new Set();
  }
}

/**
 * Create a GitHub issue and return its number + URL.
 */
function createIssue(entry) {
  const { title, body, milestone_name, labels } = entry;

  if (!milestones[milestone_name]) {
    throw new Error(`Unknown milestone: "${milestone_name}"`);
  }

  let cmd = `gh issue create --repo ${REPO}`;
  cmd += ` --title ${JSON.stringify(title)}`;
  cmd += ` --body ${JSON.stringify(body)}`;
  cmd += ` --milestone ${JSON.stringify(milestone_name)}`;

  if (labels && labels.length > 0) {
    for (const label of labels) {
      cmd += ` --label ${JSON.stringify(label)}`;
    }
  }

  const output = run(cmd, 'gh issue create');

  if (DRY_RUN) return { number: 0, url: `https://github.com/${REPO}/issues/0` };

  // gh issue create outputs the issue URL as the last line
  const url = output.split('\n').filter(Boolean).pop();
  const match = url.match(/\/issues\/(\d+)$/);
  if (!match) {
    throw new Error(`Could not parse issue number from: ${output}`);
  }
  return { number: parseInt(match[1], 10), url };
}

/**
 * Add an issue to the GitHub Project and return the item node ID.
 */
function addToProject(issueUrl) {
  const cmd = `gh project item-add ${PROJECT_NUMBER} --owner ${OWNER} --url ${issueUrl} --format json`;
  const raw = run(cmd, 'gh project item-add');
  if (DRY_RUN) return '__DRY_RUN_ITEM_ID__';

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Could not parse item-add output: ${raw}`);
  }

  // The item node ID is returned as `id` in the JSON output
  const itemId = parsed.id;
  if (!itemId) {
    throw new Error(`No item id in item-add response: ${raw}`);
  }
  return itemId;
}

/**
 * Set a single-select field on a project item.
 */
function setField(itemId, fieldId, optionId) {
  const cmd = [
    'gh project item-edit',
    `--project-id ${projectId}`,
    `--id ${itemId}`,
    `--field-id ${fieldId}`,
    `--single-select-option-id ${optionId}`,
  ].join(' ');
  run(cmd, 'gh project item-edit');
}

/**
 * Resolve a field option ID given field name and option name.
 * Throws clearly if unknown.
 */
function resolveOption(fieldName, optionName) {
  const options = fieldOptions[fieldName];
  if (!options) throw new Error(`Unknown field: "${fieldName}"`);
  const id = options[optionName];
  if (!id) {
    throw new Error(
      `Unknown option "${optionName}" for field "${fieldName}". ` +
      `Valid options: ${Object.keys(options).join(', ')}`
    );
  }
  return id;
}

/**
 * Ensure a GitHub label exists (creates it if missing, silently skips on conflict).
 */
const ensuredLabels = new Set();
function ensureLabel(labelName) {
  if (ensuredLabels.has(labelName)) return;
  ensuredLabels.add(labelName);

  // Map label names to colors
  const COLOR_MAP = {
    'area:engine':       '0075ca',
    'area:mcp':          'e4e669',
    'area:skills':       'd93f0b',
    'area:plugin':       '0e8a16',
    'area:distribution': 'bfd4f2',
    'area:catalog':      'f9d0c4',
    'area:devops':       'c5def5',
    'area:docs':         'fef2c0',
    'area:licensing':    'b60205',
    'area:marketplace':  'ededed',
  };
  const color = COLOR_MAP[labelName] || 'cccccc';
  const description = labelName.replace('area:', 'Area: ').replace(/^./, s => s.toUpperCase());

  try {
    if (!DRY_RUN) {
      execSync(
        `gh label create ${JSON.stringify(labelName)} --repo ${REPO} --color ${color} --description ${JSON.stringify(description)}`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
    } else {
      console.log(`  [DRY-RUN] gh label create "${labelName}"`);
    }
  } catch (err) {
    // 422 = already exists — safe to ignore
    const msg = err.stderr?.trim() || '';
    if (!msg.includes('already exists') && !msg.includes('Name has already been taken')) {
      console.warn(`  Warning: could not ensure label "${labelName}": ${msg}`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`OpenDeck Factory — bulk issue backfill`);
  console.log(`Repo:    ${REPO}`);
  console.log(`Project: #${PROJECT_NUMBER} (${projectId})`);
  console.log(`Items:   ${inventory.length}`);
  if (DRY_RUN) console.log(`Mode:    DRY RUN — no API calls will be made`);
  console.log('');

  // Pre-flight: fetch priority option IDs if not in project-ids.json
  if (!fieldOptions.priority || Object.keys(fieldOptions.priority).length === 0) {
    fetchPriorityOptions();
  }
  console.log('');

  // Pre-flight: ensure all labels exist
  console.log('Ensuring labels exist...');
  const allLabels = new Set(inventory.flatMap(e => e.labels || []));
  for (const label of allLabels) {
    ensureLabel(label);
  }
  console.log('');

  // Fetch existing issues for duplicate detection
  const existingTitles = DRY_RUN ? new Set() : fetchExistingTitles();
  console.log(`Found ${existingTitles.size} existing issue(s).\n`);

  // Stats
  let created = 0;
  let skipped = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < inventory.length; i++) {
    const entry = inventory[i];
    const counter = `[${String(i + 1).padStart(2, '0')}/${inventory.length}]`;

    // Duplicate check
    if (existingTitles.has(entry.title.toLowerCase().trim())) {
      console.log(`${counter} [SKIP] ${entry.title}`);
      skipped++;
      continue;
    }

    console.log(`${counter} Creating: ${entry.title}`);

    try {
      // 1. Validate field values before making any API calls
      const statusOptionId = resolveOption('status', 'Todo');
      const areaOptionId = resolveOption('area', entry.area);
      const priorityOptionId = resolveOption('priority', entry.priority);
      const targetOptionId = resolveOption('target', entry.target);
      const sizeOptionId = resolveOption('size', entry.size);
      const revenueOptionId = resolveOption('revenue_impact', entry.revenue_impact);

      // 2. Create the issue
      const { number, url } = createIssue(entry);
      if (!DRY_RUN) console.log(`         Issue #${number} → ${url}`);

      // Add to known titles so we don't double-create if the script is re-run
      // without a fresh fetch (defensive)
      existingTitles.add(entry.title.toLowerCase().trim());

      // 3. Add to project
      const itemId = addToProject(url);
      if (!DRY_RUN) console.log(`         Project item: ${itemId}`);

      // 4. Set all project fields
      setField(itemId, fieldIds.status, statusOptionId);
      setField(itemId, fieldIds.area, areaOptionId);
      setField(itemId, fieldIds.priority, priorityOptionId);
      setField(itemId, fieldIds.target, targetOptionId);
      setField(itemId, fieldIds.size, sizeOptionId);
      setField(itemId, fieldIds.revenue_impact, revenueOptionId);

      if (!DRY_RUN) console.log(`         Fields set: Area=${entry.area}, Priority=${entry.priority}, Target=${entry.target}, Size=${entry.size}, Revenue=${entry.revenue_impact}`);

      created++;
    } catch (err) {
      console.error(`         [FAIL] ${err.message}`);
      failed++;
      failures.push({ title: entry.title, error: err.message });
    }

    // Rate-limit pause between creates (skip after last item)
    if (i < inventory.length - 1 && !DRY_RUN) {
      await sleep(DELAY_MS);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('');
  console.log('══════════════════════════════════════════');
  console.log(' Backfill complete');
  console.log('══════════════════════════════════════════');
  console.log(` Created : ${created}`);
  console.log(` Skipped : ${skipped}`);
  console.log(` Failed  : ${failed}`);
  console.log('══════════════════════════════════════════');

  if (failures.length > 0) {
    console.log('');
    console.log('Failures:');
    for (const f of failures) {
      console.log(`  ✗ ${f.title}`);
      console.log(`    ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
