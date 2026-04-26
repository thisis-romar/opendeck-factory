#!/usr/bin/env node
/**
 * Assign the current sprint iteration to all In Progress and Todo project items
 * that don't already have a sprint set.
 *
 * Run: node scripts/gh-set-sprint.mjs [--dry-run] [--force]
 *   --dry-run  Print plan without mutating
 *   --force    Assign sprint even to items that already have one
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gql, gqlAll } from './lib/gql.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ids = JSON.parse(readFileSync(path.join(ROOT, '.github', 'project-ids.json'), 'utf8'));

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE   = process.argv.includes('--force');

const SPRINT_FIELD_ID = ids.fieldIds.sprint;
const PROJECT_ID      = ids.projectId;
const PROJECT_NUMBER  = ids.projectNumber;
const OWNER           = 'thisis-romar';

const IN_PROGRESS_ID  = ids.fieldOptions.status['In Progress'];
const TODO_ID         = ids.fieldOptions.status['Todo'];

function getCurrentIteration() {
  const q = `{
    node(id: "${SPRINT_FIELD_ID}") {
      ... on ProjectV2IterationField {
        configuration {
          iterations { id title startDate duration }
        }
      }
    }
  }`;
  const result = gql(q);
  const iters = result.data?.node?.configuration?.iterations ?? [];
  if (!iters.length) {
    console.error('No sprint iterations found. Run this first to create one:');
    console.error('  node scripts/gh-set-sprint.mjs --create-sprint "Sprint 1" 2026-04-27');
    return null;
  }
  // Pick the iteration with the most recent startDate that is <= today
  const today = new Date().toISOString().slice(0, 10);
  const active = iters
    .filter(i => i.startDate <= today)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
    ?? iters[0]; // fallback to first upcoming iteration
  return active;
}

function fetchAllProjectItems() {
  const raw = gqlAll(
    after => `{
      user(login: "${OWNER}") {
        projectV2(number: ${PROJECT_NUMBER}) {
          items(first: 100${after}) {
            nodes {
              id
              fieldValues(first: 20) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    field { ... on ProjectV2FieldCommon { name } }
                    optionId
                    name
                  }
                  ... on ProjectV2ItemFieldIterationValue {
                    field { ... on ProjectV2FieldCommon { name } }
                    iterationId
                    title
                  }
                }
              }
              content {
                ... on Issue { number title state }
                ... on PullRequest { number title state }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }`,
    data => data.user.projectV2.items,
  );
  return raw.map(item => {
    let statusOptionId = null, sprintId = null;
    for (const fv of item.fieldValues?.nodes ?? []) {
      const fname = fv.field?.name;
      if (fname === 'Status') statusOptionId = fv.optionId;
      if (fname === 'Sprint') sprintId = fv.iterationId;
    }
    return {
      id: item.id,
      num: item.content?.number ?? '?',
      title: item.content?.title ?? 'Draft',
      state: item.content?.state ?? null,
      statusOptionId,
      sprintId,
    };
  });
}

function assignSprint(itemId, iterationId) {
  const mut = `mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "${PROJECT_ID}"
      itemId: "${itemId}"
      fieldId: "${SPRINT_FIELD_ID}"
      value: { iterationId: "${iterationId}" }
    }) { projectV2Item { id } }
  }`;
  gql(mut);
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`gh-set-sprint${DRY_RUN ? ' [DRY RUN]' : ''}`);

const sprint = getCurrentIteration();
if (!sprint) process.exit(1);
console.log(`Current sprint: "${sprint.title}" (${sprint.id}) — starts ${sprint.startDate}, ${sprint.duration} days`);

const allItems = fetchAllProjectItems();
console.log(`Fetched ${allItems.length} project items`);

// By default: only assign sprint to "In Progress" items.
// Pass --include-todo to also include "Todo" items.
const INCLUDE_TODO = process.argv.includes('--include-todo');

const targets = allItems.filter(item => {
  const isInProgress = item.statusOptionId === IN_PROGRESS_ID;
  const isTodo = item.statusOptionId === TODO_ID && INCLUDE_TODO;
  const needsSprint = FORCE || !item.sprintId;
  return (isInProgress || isTodo) && needsSprint;
});

console.log(`\n${targets.length} item(s) to assign sprint:`);
let assigned = 0, failed = 0;

for (const item of targets) {
  const alreadyMsg = item.sprintId ? ` (overwriting "${item.sprintId}")` : '';
  const stateMsg = item.state ? ` [${item.state}]` : '';
  console.log(`  ${DRY_RUN ? '[DRY]' : '     '} #${item.num} ${item.title.slice(0, 60)}${stateMsg}${alreadyMsg}`);

  if (!DRY_RUN) {
    try {
      assignSprint(item.id, sprint.id);
      assigned++;
    } catch (err) {
      console.error(`    ERROR: ${err.message}`);
      failed++;
    }
  }
}

if (!DRY_RUN) {
  console.log(`\nDone. Assigned: ${assigned}  Failed: ${failed}`);
} else {
  console.log(`\nDry run complete — ${targets.length} would be assigned sprint "${sprint.title}"`);
}
