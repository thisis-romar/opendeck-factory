#!/usr/bin/env node
/**
 * Backfill Target Date and Start Date on open project items from their milestone.
 *
 * Milestone → Target Date mapping (from GitHub milestone due_on):
 *   v2.3.0    → 2026-05-15
 *   v2.4.0    → 2026-06-30
 *   v2.5.0    → 2026-08-15
 *   Catalog-v1 → 2026-06-01
 *   Catalog-v2 → 2026-09-15
 *   v3.0.0    → 2026-10-01
 *   v3.1.0    → 2026-12-15
 *   Future / none → skip
 *
 * Start Date for all open items without one → today (script run date).
 *
 * Flags: --dry-run   Print plan without mutating.
 *        --force     Overwrite existing dates (default: skip if already set).
 *
 * Run: node scripts/gh-set-milestone-dates.mjs [--dry-run] [--force]
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ids = JSON.parse(readFileSync(path.join(ROOT, '.github', 'project-ids.json'), 'utf8'));

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE   = process.argv.includes('--force');

const OWNER       = 'thisis-romar';
const REPO        = 'opendeck-factory';
const PROJECT_ID  = ids.projectId ?? 'PVT_kwHODNwyZM4BVh2a';
const PROJECT_NUM = ids.projectNumber ?? 4;
const START_FIELD = ids.fieldIds?.start_date  ?? 'PVTF_lAHODNwyZM4BVh2azhRChJQ';
const END_FIELD   = ids.fieldIds?.target_date ?? 'PVTF_lAHODNwyZM4BVh2azhRChJU';

// Milestone title → target date (from milestone due_on values set in Phase 1b)
const MILESTONE_TARGET = {
  'v2.3.0':    '2026-05-15',
  'v2.4.0':    '2026-06-30',
  'v2.5.0':    '2026-08-15',
  'Catalog-v1': '2026-06-01',
  'Catalog-v2': '2026-09-15',
  'v3.0.0':    '2026-10-01',
  'v3.1.0':    '2026-12-15',
};

// For items in a given milestone, the start date is the previous milestone's end + 1 day
const MILESTONE_START = {
  'v2.3.0':    '2026-04-27', // Sprint start (first sprint after v2.2.0)
  'v2.4.0':    '2026-05-16',
  'v2.5.0':    '2026-07-01',
  'Catalog-v1': '2026-04-27',
  'Catalog-v2': '2026-06-02',
  'v3.0.0':    '2026-08-16',
  'v3.1.0':    '2026-10-02',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function graphql(query, ...extra) {
  const r = spawnSync('gh', ['api', 'graphql', '-f', `query=${query}`, ...extra], { encoding: 'utf8' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`GraphQL: ${r.stderr}`);
  const d = JSON.parse(r.stdout);
  if (d.errors) throw new Error(`GraphQL errors: ${JSON.stringify(d.errors)}`);
  return d.data;
}

function setDate(itemId, fieldId, dateStr) {
  const m = `mutation { updateProjectV2ItemFieldValue(input: { projectId: "${PROJECT_ID}", itemId: "${itemId}", fieldId: "${fieldId}", value: { date: "${dateStr}" } }) { projectV2Item { id } } }`;
  graphql(m);
}

// ── Fetch all open project items with their current field values ───────────────

console.log(`Fetching open items from project #${PROJECT_NUM}${DRY_RUN ? ' [DRY RUN]' : ''}...`);

let allItems = [];
let cursor = null;
let hasNext = true;

while (hasNext) {
  const after = cursor ? `, after: "${cursor}"` : '';
  const q = `{
    user(login: "${OWNER}") {
      projectV2(number: ${PROJECT_NUM}) {
        items(first: 100${after}) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            content {
              ... on Issue { number title state milestone { title } }
              ... on PullRequest { number title state }
            }
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldDateValue {
                  date
                  field { ... on ProjectV2Field { name } }
                }
              }
            }
          }
        }
      }
    }
  }`;

  const data = graphql(q);
  const page = data.user.projectV2.items;
  allItems = allItems.concat(page.nodes);
  hasNext = page.pageInfo.hasNextPage;
  cursor = page.pageInfo.endCursor;
}

console.log(`  Fetched ${allItems.length} total project items.\n`);

// ── Process each item ─────────────────────────────────────────────────────────

let updated = 0, skipped = 0, noMilestone = 0;

for (const item of allItems) {
  const issue = item.content;
  if (!issue?.number) continue;               // draft issue or PR without issue
  if (issue.state === 'CLOSED') continue;      // only update open items

  const milestone = issue.milestone?.title;
  const targetDate = milestone ? MILESTONE_TARGET[milestone] : null;
  const startDate  = milestone ? MILESTONE_START[milestone]  : null;

  if (!targetDate) {
    noMilestone++;
    continue; // Future or no milestone — leave blank
  }

  // Check existing date values
  const existing = {};
  for (const fv of item.fieldValues.nodes) {
    if (fv.date && fv.field?.name) existing[fv.field.name] = fv.date;
  }

  const hasStart  = Boolean(existing['Start Date']);
  const hasTarget = Boolean(existing['Target Date']);

  const needsStart  = !hasStart  || FORCE;
  const needsTarget = !hasTarget || FORCE;

  if (!needsStart && !needsTarget) {
    skipped++;
    continue;
  }

  const changes = [];
  if (needsStart)  changes.push(`Start: ${startDate}`);
  if (needsTarget) changes.push(`Target: ${targetDate}`);

  const title = issue.title.substring(0, 50);
  console.log(`  #${String(issue.number).padEnd(4)} [${milestone.padEnd(10)}] ${title.padEnd(51)} ${changes.join(' | ')}`);

  if (!DRY_RUN) {
    try {
      if (needsStart  && startDate)  setDate(item.id, START_FIELD, startDate);
      if (needsTarget && targetDate)  setDate(item.id, END_FIELD,   targetDate);
      updated++;
    } catch (err) {
      console.error(`    ERROR on #${issue.number}: ${err.message.substring(0, 80)}`);
    }
  } else {
    updated++;
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`${DRY_RUN ? '[DRY RUN] Would update' : 'Updated'}: ${updated}`);
console.log(`Skipped (already has dates): ${skipped}`);
console.log(`No milestone / Future: ${noMilestone}`);
console.log('\nMilestone date ranges on the roadmap:');
for (const [ms, end] of Object.entries(MILESTONE_TARGET)) {
  console.log(`  ${ms.padEnd(12)} ${MILESTONE_START[ms]} → ${end}`);
}
