#!/usr/bin/env node
/**
 * Sync project Status when a PR is opened, reopened, or changes draft state.
 * - Draft PR opened/converted_to_draft → linked closing issues → Status: In Progress
 * - Non-draft PR opened/ready_for_review/reopened → linked closing issues → Status: In Review
 *
 * Uses closingIssuesReferences (Closes #N / Fixes #N / sidebar-linked issues).
 * Skips any issue already at Done to avoid stomping over a merged-then-reopened flow.
 *
 * Called by .github/workflows/project-sync.yml on pull_request.opened|reopened|
 *   ready_for_review|converted_to_draft.
 *
 * Run manually: GH_PR_NUMBER=<n> node scripts/gh-sync-pr-status.mjs [--dry-run]
 *          or: node scripts/gh-sync-pr-status.mjs <n> [--dry-run]
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gql } from './lib/gql.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ids = JSON.parse(readFileSync(path.join(ROOT, '.github', 'project-ids.json'), 'utf8'));

const DRY_RUN   = process.argv.includes('--dry-run');
const numArg    = process.argv.slice(2).find(a => /^\d+$/.test(a));
const PR_NUMBER = parseInt(process.env.GH_PR_NUMBER ?? numArg ?? '');
const OWNER     = 'thisis-romar';
const REPO      = 'opendeck-factory';

const PROJECT_ID      = ids.projectId;
const STATUS_FIELD_ID = ids.fieldIds.status;
const STATUS_IN_REVIEW   = ids.fieldOptions.status['In Review'];
const STATUS_IN_PROGRESS = ids.fieldOptions.status['In Progress'];
const STATUS_DONE        = ids.fieldOptions.status['Done'];

if (!PR_NUMBER || isNaN(PR_NUMBER)) {
  console.error('Usage: GH_PR_NUMBER=<n> node scripts/gh-sync-pr-status.mjs');
  console.error('   or: node scripts/gh-sync-pr-status.mjs <n>');
  process.exit(1);
}

// Fetch PR metadata + issues this PR will close
const prData = gql(`{
  repository(owner: "${OWNER}", name: "${REPO}") {
    pullRequest(number: ${PR_NUMBER}) {
      number title isDraft
      closingIssuesReferences(first: 20) {
        nodes { id number title }
      }
    }
  }
}`);

const pr = prData.data.repository.pullRequest;
if (!pr) {
  console.error(`PR #${PR_NUMBER} not found in ${OWNER}/${REPO}`);
  process.exit(1);
}

const label = `[PR #${PR_NUMBER}${DRY_RUN ? ' DRY RUN' : ''}]`;
console.log(`${label} "${pr.title}" — ${pr.isDraft ? 'draft' : 'ready'}`);

const closingIssues = pr.closingIssuesReferences.nodes;
if (closingIssues.length === 0) {
  console.log(`${label} No closing-issue references — nothing to update.`);
  process.exit(0);
}

const targetId   = pr.isDraft ? STATUS_IN_PROGRESS : STATUS_IN_REVIEW;
const targetName = pr.isDraft ? 'In Progress' : 'In Review';

for (const issue of closingIssues) {
  console.log(`  Issue #${issue.number}: "${issue.title}"`);

  if (DRY_RUN) {
    console.log(`    [dry] Would set Status = ${targetName}`);
    continue;
  }

  // Add to project — idempotent (returns existing item if already present)
  const added = gql(`mutation {
    addProjectV2ItemById(input: {
      projectId: "${PROJECT_ID}"
      contentId: "${issue.id}"
    }) { item { id } }
  }`);
  const itemId = added.data.addProjectV2ItemById.item.id;

  // Skip if already Done — don't stomp on a merged-then-reopened sequence
  const current = gql(`{
    node(id: "${itemId}") {
      ... on ProjectV2Item {
        fieldValueByName(name: "Status") {
          ... on ProjectV2ItemFieldSingleSelectValue { optionId name }
        }
      }
    }
  }`);
  const currentStatus = current.data.node.fieldValueByName;
  if (currentStatus?.optionId === STATUS_DONE) {
    console.log(`    Skip — already Done`);
    continue;
  }

  gql(`mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "${PROJECT_ID}"
      itemId: "${itemId}"
      fieldId: "${STATUS_FIELD_ID}"
      value: { singleSelectOptionId: "${targetId}" }
    }) { projectV2Item { id } }
  }`);
  console.log(`    Set Status = ${targetName} (was ${currentStatus?.name ?? 'None'})`);
}

console.log('Done.');
