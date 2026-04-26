#!/usr/bin/env node
/**
 * Set Start Date + Target Date on all project items that have completed work,
 * derived from the git commit history and GitHub issue close dates.
 *
 * Date evidence (from git log + gh issue list):
 *   v2.0.0  tagged 2026-04-22  (first commit 2026-04-18)
 *   v2.1.0  PR #2  merged 2026-04-22
 *   v2.2.0  released 2026-04-22/23
 *   v2.3.0  GitHub PM work 2026-04-23 → 2026-04-26
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ids = JSON.parse(readFileSync(path.join(ROOT, '.github', 'project-ids.json'), 'utf8'));

const DRY_RUN = process.argv.includes('--dry-run');
const OWNER = 'thisis-romar';
const PROJECT_ID  = ids.projectId   ?? 'PVT_kwHODNwyZM4BVh2a';
const PROJECT_NUM = ids.projectNumber ?? 4;
const START_FIELD = ids.fieldIds?.start_date  ?? 'PVTF_lAHODNwyZM4BVh2azhRChJQ';
const END_FIELD   = ids.fieldIds?.target_date ?? 'PVTF_lAHODNwyZM4BVh2azhRChJU';

// ── Date map: issue number → { start, end } ──────────────────────────────────
// Derived from git log analysis 2026-04-26
const DATE_MAP = {
  // v2.0.0 — first commit 2026-04-18, tagged 2026-04-22
  1:  { start: '2026-04-18', end: '2026-04-22' }, // No readme

  // v2.1.0 — PR #2 merged 2026-04-22
  // "feat: MCP server, Claude Code plugin, reference profile v2.1.0 (#2)"
  3:  { start: '2026-04-22', end: '2026-04-22' }, // MCP server — 9 tools shipped
  8:  { start: '2026-04-22', end: '2026-04-22' }, // Claude Code plugin manifest
  10: { start: '2026-04-21', end: '2026-04-22' }, // Reference profile (work started Apr 21)

  // v2.2.0 — core work 2026-04-22, GH release 2026-04-23
  // "feat: add install-profile.js" / "feat: add verify-profile.js" / "feat: add live_test_profile"
  4:  { start: '2026-04-22', end: '2026-04-22' }, // install-profile.js
  5:  { start: '2026-04-22', end: '2026-04-22' }, // verify-profile.js
  6:  { start: '2026-04-22', end: '2026-04-22' }, // live_test_profile MCP tool
  7:  { start: '2026-04-22', end: '2026-04-23' }, // v2.2.0 GitHub Release (commit Apr 22, publish Apr 23)
  9:  { start: '2026-04-21', end: '2026-04-22' }, // 3 Claude Code skills (work Apr 21, v2.2.0 Apr 22)
  11: { start: '2026-04-22', end: '2026-04-23' }, // Marketplace — claudemarketplaces.com
  12: { start: '2026-04-22', end: '2026-04-23' }, // Marketplace — skills.sh / npx skills

  // v2.2.0 (manually closed 2026-04-23)
  16: { start: '2026-04-23', end: '2026-04-24' }, // GitHub Projects v2 board (setup Apr 23, schema Apr 24)

  // Closed as duplicates 2026-04-26 (git hooks work committed 2026-04-22)
  17: { start: '2026-04-22', end: '2026-04-22' }, // Git hooks migration
  18: { start: '2026-04-22', end: '2026-04-22' }, // CHANGELOG automation

  // GitHub PM brain work 2026-04-24 → 2026-04-26
  28: { start: '2026-04-24', end: '2026-04-26' }, // Project infra — gh-pm-brain
  29: { start: '2026-04-23', end: '2026-04-24' }, // Project infra — gh-projects-views

  // Catalog v1 issue (closed as dup 2026-04-26, created 2026-04-24)
  69: { start: '2026-04-24', end: '2026-04-26' },

  // PRs that are in the project
  2:  { start: '2026-04-22', end: '2026-04-22' }, // PR: MCP server v2.1.0 (merged Apr 22)
  30: { start: '2026-04-24', end: '2026-04-26' }, // PR: OpenDeck Roadmap full infra buildout
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function graphql(query, ...fields) {
  const result = spawnSync('gh', ['api', 'graphql', '-f', `query=${query}`, ...fields], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`GraphQL error: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  if (data.errors) throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  return data.data;
}

async function setDate(itemId, fieldId, dateStr) {
  const q = `mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "${PROJECT_ID}"
      itemId: "${itemId}"
      fieldId: "${fieldId}"
      value: { date: "${dateStr}" }
    }) { projectV2Item { id } }
  }`;
  graphql(q);
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`Setting dates on project #${PROJECT_NUM} items${DRY_RUN ? ' [DRY RUN]' : ''}...\n`);

// Fetch all project items with their linked issue numbers (paginated, max 100 per page)
let allItems = [];
let cursor = null;
let hasNext = true;

while (hasNext) {
  const afterClause = cursor ? `, after: "${cursor}"` : '';
  const q = `{
    user(login: "${OWNER}") {
      projectV2(number: ${PROJECT_NUM}) {
        items(first: 100${afterClause}) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            content {
              ... on Issue { number title }
              ... on PullRequest { number title }
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

console.log(`Fetched ${allItems.length} project items.\n`);

let updated = 0;
let skipped = 0;
let noMap = 0;

for (const item of allItems) {
  const num = item.content?.number;
  if (!num) { skipped++; continue; }

  const dates = DATE_MAP[num];
  if (!dates) { noMap++; continue; }

  const title = item.content?.title ?? `#${num}`;
  if (DRY_RUN) {
    console.log(`  [dry-run] #${num} "${title.substring(0, 55)}" → start:${dates.start}  end:${dates.end}`);
    updated++;
    continue;
  }

  process.stdout.write(`  #${num} ${title.substring(0, 45).padEnd(46)} `);
  try {
    setDate(item.id, START_FIELD, dates.start);
    setDate(item.id, END_FIELD, dates.end);
    process.stdout.write(`${dates.start} → ${dates.end} ✓\n`);
    updated++;
  } catch (err) {
    process.stdout.write(`✗ ${err.message.substring(0, 60)}\n`);
  }
}

console.log(`\nDone.  Updated: ${updated}  Skipped (no issue): ${skipped}  No date map: ${noMap}`);
if (noMap > 0) {
  console.log('Issues without date map (add to DATE_MAP if needed):');
  for (const item of allItems) {
    if (item.content?.number && !DATE_MAP[item.content.number]) {
      console.log(`  #${item.content.number} — ${item.content.title?.substring(0, 60)}`);
    }
  }
}
