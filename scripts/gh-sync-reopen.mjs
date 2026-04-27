#!/usr/bin/env node
/**
 * When a GitHub issue is reopened: if its current project Status is Done,
 * revert it to Todo. Otherwise leave it unchanged.
 *
 * Called by .github/workflows/project-sync.yml on issues.reopened.
 * Reads GH_ISSUE_NUMBER from env (set by the workflow).
 *
 * Run manually: GH_ISSUE_NUMBER=<n> node scripts/gh-sync-reopen.mjs [--dry-run]
 *          or: node scripts/gh-sync-reopen.mjs <n> [--dry-run]
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gql } from './lib/gql.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ids = JSON.parse(readFileSync(path.join(ROOT, '.github', 'project-ids.json'), 'utf8'));

const DRY_RUN      = process.argv.includes('--dry-run');
const numArg       = process.argv.slice(2).find(a => /^\d+$/.test(a));
const ISSUE_NUMBER = parseInt(process.env.GH_ISSUE_NUMBER ?? numArg ?? '');
const OWNER        = 'thisis-romar';
const REPO         = 'opendeck-factory';

const PROJECT_ID      = ids.projectId;
const STATUS_FIELD_ID = ids.fieldIds.status;
const STATUS_TODO     = ids.fieldOptions.status['Todo'];
const STATUS_DONE     = ids.fieldOptions.status['Done'];

if (!ISSUE_NUMBER || isNaN(ISSUE_NUMBER)) {
  console.error('Usage: GH_ISSUE_NUMBER=<n> node scripts/gh-sync-reopen.mjs');
  console.error('   or: node scripts/gh-sync-reopen.mjs <n>');
  process.exit(1);
}

console.log(`Reopened issue #${ISSUE_NUMBER}${DRY_RUN ? ' [DRY RUN]' : ''}...`);

// Resolve issue node ID via GraphQL
const issueData = gql(`{
  repository(owner: "${OWNER}", name: "${REPO}") {
    issue(number: ${ISSUE_NUMBER}) { id title }
  }
}`);
const issue = issueData.data.repository.issue;
if (!issue) {
  console.error(`Issue #${ISSUE_NUMBER} not found in ${OWNER}/${REPO}`);
  process.exit(1);
}
console.log(`  Title: ${issue.title}`);

if (DRY_RUN) {
  console.log(`  [dry] Would check Status; revert Done→Todo if needed`);
  process.exit(0);
}

// Add to project — idempotent (returns existing item if already present)
const added = gql(`mutation {
  addProjectV2ItemById(input: {
    projectId: "${PROJECT_ID}"
    contentId: "${issue.id}"
  }) { item { id } }
}`);
const itemId = added.data.addProjectV2ItemById.item.id;

// Read current Status
const current = gql(`{
  node(id: "${itemId}") {
    ... on ProjectV2Item {
      fieldValueByName(name: "Status") {
        ... on ProjectV2ItemFieldSingleSelectValue { optionId name }
      }
    }
  }
}`);
const status = current.data.node.fieldValueByName;
const currentName = status?.name ?? 'None';
console.log(`  Current Status: ${currentName}`);

if (status?.optionId !== STATUS_DONE) {
  console.log(`  Status is not Done — no change needed.`);
} else {
  gql(`mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "${PROJECT_ID}"
      itemId: "${itemId}"
      fieldId: "${STATUS_FIELD_ID}"
      value: { singleSelectOptionId: "${STATUS_TODO}" }
    }) { projectV2Item { id } }
  }`);
  console.log(`  Reverted Status: Done → Todo`);
}

console.log('Done.');
