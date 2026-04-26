#!/usr/bin/env node
/**
 * Create epic parent issues and link all 80 backfilled component issues as sub-issues.
 *
 * Reads:
 *   scripts/component-epics.json    — 14 epics (3 reuse existing issues, 11 new)
 *   scripts/component-inventory.json — 80 child issues with parent_title field
 *   .github/project-ids.json        — project number, field IDs, option IDs
 *
 * Steps:
 *   1. Create `epic` label if missing.
 *   2. Close duplicates: #17, #18, #69.
 *   3. Retarget #19 milestone to Catalog-v1 + add epic label.
 *   4. Fetch all open issues once → title→{number,id} map.
 *   5. For each epic: reuse or create; add to project; set fields.
 *   6. For each child with parent_title: call addSubIssue mutation.
 *   7. Verification pass: print summary table.
 *
 * Flags: --dry-run  Print plan without mutating.
 *
 * Run: node scripts/gh-link-subissues.mjs [--dry-run]
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const DRY_RUN = process.argv.includes('--dry-run');

const epics = JSON.parse(readFileSync(path.join(ROOT, 'scripts', 'component-epics.json'), 'utf8'));
const inventory = JSON.parse(readFileSync(path.join(ROOT, 'scripts', 'component-inventory.json'), 'utf8'));
const ids = JSON.parse(readFileSync(path.join(ROOT, '.github', 'project-ids.json'), 'utf8'));

const OWNER = 'thisis-romar';
const REPO = 'opendeck-factory';
const PROJECT_NUMBER = ids.projectNumber ?? 4;
const PROJECT_ID = ids.projectId ?? 'PVT_kwHODNwyZM4BVh2a';

// ── Helpers ──────────────────────────────────────────────────────────────────

function gh(...args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim(), status: result.status };
}

function graphql(query, ...fields) {
  const args = ['api', 'graphql', '-f', `query=${query}`, ...fields];
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`GraphQL error: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  if (data.errors) throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  return data.data;
}

function action(label, fn) {
  if (DRY_RUN) { console.log(`  [dry-run] ${label}`); return null; }
  process.stdout.write(`  ${label}... `);
  try {
    const result = fn();
    console.log('✓');
    return result;
  } catch (err) {
    console.log('✗');
    console.error(`    ERROR: ${err.message}`);
    return null;
  }
}

// ── Step 1: Create `epic` label if missing ──────────────────────────────────

console.log('\n1. Ensuring `epic` label exists...');
const labelsRaw = gh('label', 'list', '--repo', `${OWNER}/${REPO}`, '--json', 'name', '--limit', '100');
const existingLabels = new Set(JSON.parse(labelsRaw.stdout).map(l => l.name));

if (!existingLabels.has('epic')) {
  action('Create epic label', () =>
    gh('label', 'create', 'epic', '--repo', `${OWNER}/${REPO}`, '--color', '5319E7', '--description', 'Epic — has sub-issues')
  );
} else {
  console.log('  `epic` label already exists.');
}

// ── Step 2: Close duplicates ─────────────────────────────────────────────────

console.log('\n2. Closing duplicate issues (#17, #18, #69)...');
const duplicates = [
  { number: 17, comment: 'Closing as duplicate of #79 (created during Phase 4 component backfill with more specific scope: commitlint + husky pre-commit hooks).' },
  { number: 18, comment: 'Closing as duplicate of #80 (created during Phase 4 component backfill).' },
  { number: 69, comment: 'Closing as duplicate of #19 (Catalog v1 epic). This issue was created during Phase 4 backfill; the work is now tracked under epic #19 with children #70, #71, #72.' },
];

for (const { number, comment } of duplicates) {
  // Check if already closed
  const stateRaw = gh('issue', 'view', String(number), '--repo', `${OWNER}/${REPO}`, '--json', 'state');
  const state = JSON.parse(stateRaw.stdout).state;
  if (state === 'CLOSED') {
    console.log(`  #${number} already closed — skipping.`);
    continue;
  }
  action(`Close #${number} as duplicate`, () => {
    gh('issue', 'close', String(number), '--repo', `${OWNER}/${REPO}`, '--comment', comment);
  });
}

// ── Step 3: Retarget #19 to Catalog-v1 milestone + add epic label ────────────

console.log('\n3. Retargeting #19 to Catalog-v1 milestone + adding epic label...');
action('Edit #19 milestone + label', () => {
  gh('issue', 'edit', '19', '--repo', `${OWNER}/${REPO}`, '--milestone', 'Catalog-v1', '--add-label', 'epic');
});

// ── Step 4: Fetch all open issues ────────────────────────────────────────────

console.log('\n4. Fetching all open issues for title→ID lookup...');

/** @type {Map<string, {number: number, id: string}>} */
const issueMap = new Map(); // title_lowercase -> {number, id}

let hasNextPage = true;
let cursor = null;
let totalFetched = 0;

while (hasNextPage) {
  const afterClause = cursor ? `, after: "${cursor}"` : '';
  const q = `
    query {
      repository(owner: "${OWNER}", name: "${REPO}") {
        issues(first: 100, states: [OPEN]${afterClause}) {
          pageInfo { hasNextPage endCursor }
          nodes { number title id }
        }
      }
    }
  `;
  const data = graphql(q);
  const page = data.repository.issues;
  for (const issue of page.nodes) {
    issueMap.set(issue.title.toLowerCase(), { number: issue.number, id: issue.id });
    totalFetched++;
  }
  hasNextPage = page.pageInfo.hasNextPage;
  cursor = page.pageInfo.endCursor;
}
console.log(`  Fetched ${totalFetched} open issues.`);

// ── Build option lookup maps from project-ids.json ───────────────────────────
// Structure: ids.fieldOptions.status = { "Todo": "f75ad846", ... }
// Structure: ids.fieldIds.status = "PVTSSF_..."

function buildOptionMap(fieldKey) {
  const raw = ids.fieldOptions?.[fieldKey] ?? {};
  return Object.fromEntries(Object.entries(raw).map(([name, id]) => [name.toLowerCase(), id]));
}

const STATUS_OPTIONS   = buildOptionMap('status');
const PRIORITY_OPTIONS = buildOptionMap('priority');
const AREA_OPTIONS     = buildOptionMap('area');
const TARGET_OPTIONS   = buildOptionMap('target');
const SIZE_OPTIONS     = buildOptionMap('size');
const REVENUE_OPTIONS  = buildOptionMap('revenue_impact');

function getOptionId(map, value) {
  if (!value) return null;
  return map[value.toLowerCase()] ?? null;
}

// ── Step 5: Create/reuse epics, add to project, set fields ───────────────────

console.log('\n5. Creating/reusing epics...');

/** @type {Map<string, {number: number, id: string}>} */
const epicMap = new Map(); // epic_title_lowercase -> {number, id}

for (const epic of epics) {
  const titleLower = epic.title.toLowerCase();
  let epicInfo;

  if (epic.reuse_existing_issue) {
    // Reuse existing issue — look it up by title in the map or by exact number
    const existing = issueMap.get(titleLower);
    if (existing) {
      epicInfo = existing;
      console.log(`  ~ Reusing #${epicInfo.number}: "${epic.title}"`);
    } else {
      // Fallback: fetch by number directly (handles title mismatches)
      console.log(`  ~ Reusing #${epic.reuse_existing_issue} (title not in map, fetching by number)...`);
      const raw = gh('issue', 'view', String(epic.reuse_existing_issue),
        '--repo', `${OWNER}/${REPO}`, '--json', 'number,id,title');
      const parsed = JSON.parse(raw.stdout);
      epicInfo = { number: parsed.number, id: parsed.id };
      // Add to issueMap under both actual title and spec title
      issueMap.set(parsed.title.toLowerCase(), epicInfo);
      issueMap.set(titleLower, epicInfo);
      console.log(`  ~ Reusing #${epicInfo.number}: "${parsed.title}"`);
    }

    // Add epic label if not already present
    action(`Add epic label to #${epicInfo.number}`, () => {
      gh('issue', 'edit', String(epicInfo.number), '--repo', `${OWNER}/${REPO}`, '--add-label', 'epic');
    });

  } else {
    // Check if epic already exists (idempotent)
    if (issueMap.has(titleLower)) {
      epicInfo = issueMap.get(titleLower);
      console.log(`  ~ Epic already exists as #${epicInfo.number}: "${epic.title}"`);
    } else if (DRY_RUN) {
      // In dry-run, add a placeholder so Step 6 can validate parent→child wiring
      epicInfo = { number: 0, id: `dry-run-${titleLower}` };
      console.log(`  [dry-run] Create epic: "${epic.title}"`);
    } else {
      // Create new epic issue
      const createArgs = [
        'issue', 'create',
        '--repo', `${OWNER}/${REPO}`,
        '--title', epic.title,
        '--body', epic.body ?? '',
        '--label', (epic.labels ?? ['epic']).join(','),
      ];
      if (epic.milestone_name) createArgs.push('--milestone', epic.milestone_name);

      const result = action(`Create epic: "${epic.title}"`, () => {
        const r = gh(...createArgs);
        if (r.status !== 0) throw new Error(r.stderr);
        // gh issue create returns the issue URL
        const match = r.stdout.match(/\/issues\/(\d+)/);
        if (!match) throw new Error('Could not parse issue number from: ' + r.stdout);
        const number = parseInt(match[1], 10);
        // Fetch node ID
        const viewRaw = gh('issue', 'view', String(number), '--repo', `${OWNER}/${REPO}`, '--json', 'number,id');
        return JSON.parse(viewRaw.stdout);
      });

      if (!result) continue;
      epicInfo = result;
      issueMap.set(titleLower, epicInfo);
      console.log(`  + Created #${epicInfo.number}: "${epic.title}"`);
    }
  }

  epicMap.set(titleLower, epicInfo);

  // Add to project and set fields
  action(`Add #${epicInfo.number} to project`, () => {
    const r = gh('project', 'item-add', String(PROJECT_NUMBER), '--owner', OWNER,
      '--url', `https://github.com/${OWNER}/${REPO}/issues/${epicInfo.number}`);
    if (r.status !== 0 && !r.stderr.includes('already')) throw new Error(r.stderr);
  });

  // Set project fields
  const FIELD_IDS = {
    status:         ids.fieldIds?.status,
    priority:       ids.fieldIds?.priority,
    area:           ids.fieldIds?.area,
    target:         ids.fieldIds?.target,
    size:           ids.fieldIds?.size,
    revenue_impact: ids.fieldIds?.revenue_impact,
  };

  // Get project item ID for this issue (paginated, max 100 per page)
  const itemQuery = `
    query($after: String) {
      user(login: "${OWNER}") {
        projectV2(number: ${PROJECT_NUMBER}) {
          items(first: 100, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              content {
                ... on Issue { number }
              }
            }
          }
        }
      }
    }
  `;

  if (!DRY_RUN) {
    try {
      // Paginate through all project items to find this epic's item ID
      let allProjectItems = [];
      let itemCursor = null;
      let itemHasNext = true;
      while (itemHasNext) {
        const cursorArg = itemCursor ? `-f after=${itemCursor}` : '';
        const r = spawnSync('gh', ['api', 'graphql', '-f', `query=${itemQuery}`, ...(itemCursor ? ['-f', `after=${itemCursor}`] : [])], { encoding: 'utf8' });
        if (r.status !== 0) throw new Error(r.stderr);
        const d = JSON.parse(r.stdout);
        const pg = d.data.user.projectV2.items;
        allProjectItems = allProjectItems.concat(pg.nodes);
        itemHasNext = pg.pageInfo.hasNextPage;
        itemCursor = pg.pageInfo.endCursor;
      }
      const item = allProjectItems.find(i => i.content?.number === epicInfo.number);
      if (item) {
        const fieldSets = [
          { fieldId: FIELD_IDS.status,         optionId: getOptionId(STATUS_OPTIONS, 'Todo') },
          { fieldId: FIELD_IDS.priority,       optionId: getOptionId(PRIORITY_OPTIONS, epic.priority) },
          { fieldId: FIELD_IDS.area,           optionId: getOptionId(AREA_OPTIONS, epic.area) },
          { fieldId: FIELD_IDS.target,         optionId: getOptionId(TARGET_OPTIONS, epic.target) },
          { fieldId: FIELD_IDS.size,           optionId: getOptionId(SIZE_OPTIONS, epic.size) },
          { fieldId: FIELD_IDS.revenue_impact, optionId: getOptionId(REVENUE_OPTIONS, epic.revenue_impact) },
        ];
        for (const { fieldId, optionId } of fieldSets) {
          if (!fieldId || !optionId) continue;
          const mutQ = `mutation { updateProjectV2ItemFieldValue(input: { projectId: "${PROJECT_ID}", itemId: "${item.id}", fieldId: "${fieldId}", value: { singleSelectOptionId: "${optionId}" } }) { projectV2Item { id } } }`;
          try { graphql(mutQ); } catch { /* best-effort */ }
        }
        process.stdout.write(`  Set fields on #${epicInfo.number} ✓\n`);
      }
    } catch (e) {
      console.warn(`  WARNING: Could not set fields on #${epicInfo.number}: ${e.message}`);
    }
  } else {
    console.log(`  [dry-run] Set fields (Status/Priority/Area/Target/Size/Revenue) on #${epicInfo.number}`);
  }
}

// ── Step 6: Link sub-issues ──────────────────────────────────────────────────

console.log('\n6. Linking sub-issues...');

let linked = 0;
let skipped_link = 0;
let failed_link = 0;

for (const entry of inventory) {
  if (!entry.parent_title) continue; // null = this entry is an epic or being closed

  const parentKey = entry.parent_title.toLowerCase();
  const childKey = entry.title.toLowerCase();

  const parent = epicMap.get(parentKey) ?? issueMap.get(parentKey);
  const child = issueMap.get(childKey);

  if (!parent) {
    console.warn(`  WARNING: parent not found for title "${entry.parent_title}"`);
    failed_link++;
    continue;
  }
  if (!child) {
    console.warn(`  WARNING: child issue not found for title "${entry.title}"`);
    failed_link++;
    continue;
  }

  if (DRY_RUN) {
    console.log(`  [dry-run] addSubIssue: parent=#${parent.number} child=#${child.number} "${entry.title}"`);
    linked++;
    continue;
  }

  const mutQ = `mutation { addSubIssue(input: { issueId: "${parent.id}", subIssueId: "${child.id}" }) { issue { number title } } }`;
  try {
    graphql(mutQ);
    process.stdout.write(`.`);
    linked++;
  } catch (err) {
    if (err.message.includes('already') || err.message.includes('duplicate')) {
      process.stdout.write(`s`); // already linked
      skipped_link++;
    } else {
      process.stdout.write(`x`);
      console.warn(`\n  WARNING: addSubIssue failed for child #${child.number}: ${err.message}`);
      failed_link++;
    }
  }
}

if (!DRY_RUN) console.log(); // newline after progress dots

console.log(`\n  Sub-issue links: ${linked} linked  ${skipped_link} already-linked  ${failed_link} failed`);

// ── Step 7: Verification ─────────────────────────────────────────────────────

console.log('\n7. Verification pass...');

if (DRY_RUN) {
  console.log('  [dry-run] Skipping verification — run without --dry-run to verify.');
  console.log('\nDry run complete. No changes were made.');
  process.exit(0);
}

let verifyFailed = 0;
for (const [titleLower, epicInfo] of epicMap) {
  try {
    const verQ = `query { node(id: "${epicInfo.id}") { ... on Issue { number title subIssues { totalCount } } } }`;
    const data = graphql(verQ);
    const count = data.node?.subIssues?.totalCount ?? 0;
    const epicTitle = data.node?.title ?? titleLower;
    const expected = inventory.filter(e => e.parent_title?.toLowerCase() === titleLower).length;
    const status = count >= expected ? '✓' : (count > 0 ? '~' : '✗');
    console.log(`  ${status}  #${epicInfo.number}  sub-issues: ${count}/${expected}  "${epicTitle}"`);
    if (count < expected) verifyFailed++;
  } catch (e) {
    console.warn(`  !  #${epicInfo.number}: verify failed (${e.message})`);
    verifyFailed++;
  }
}

console.log(`\n${verifyFailed === 0 ? '✓ All epics verified.' : `! ${verifyFailed} epic(s) need attention.`}`);
console.log(`\nDone.`);
