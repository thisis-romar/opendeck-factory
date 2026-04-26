#!/usr/bin/env node
/**
 * Triage a newly-opened issue: add it to project #4 and set Area, Priority,
 * and Status fields by parsing the issue form body.
 *
 * Called by .github/workflows/project-sync.yml on issues.opened.
 * Reads GH_ISSUE_NUMBER from env (set by the workflow).
 *
 * Run manually: GH_ISSUE_NUMBER=123 node scripts/gh-triage-new-issue.mjs [--dry-run]
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gql, gh } from './lib/gql.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ids = JSON.parse(readFileSync(path.join(ROOT, '.github', 'project-ids.json'), 'utf8'));

const DRY_RUN      = process.argv.includes('--dry-run');
const numArg       = process.argv.slice(2).find(a => /^\d+$/.test(a));
const ISSUE_NUMBER = parseInt(process.env.GH_ISSUE_NUMBER ?? numArg ?? '');
const OWNER        = 'thisis-romar';
const REPO         = 'opendeck-factory';
const PROJECT_ID   = ids.projectId;
const PROJECT_NUM  = ids.projectNumber;

if (!ISSUE_NUMBER || isNaN(ISSUE_NUMBER)) {
  console.error('Usage: GH_ISSUE_NUMBER=<n> node scripts/gh-triage-new-issue.mjs');
  console.error('   or: node scripts/gh-triage-new-issue.mjs <n>');
  process.exit(1);
}

// ── Parse issue form body ─────────────────────────────────────────────────────

/**
 * Extract a section value from a GitHub issue form body.
 * Form bodies look like:  ### Section Label\n\nValue\n\n### Next Section
 */
function parseFormField(body, ...labels) {
  for (const label of labels) {
    const regex = new RegExp(`###\\s+${label}\\s*\\n+([^#]+)`, 'i');
    const m = body.match(regex);
    if (m) return m[1].trim();
  }
  return null;
}

// ── Fetch issue ───────────────────────────────────────────────────────────────

console.log(`Triaging issue #${ISSUE_NUMBER}${DRY_RUN ? ' [DRY RUN]' : ''}...`);

const issueRaw = gh('issue', 'view', String(ISSUE_NUMBER),
  '--repo', `${OWNER}/${REPO}`,
  '--json', 'number,title,body,url,labels',
);
const issue = JSON.parse(issueRaw.stdout);
console.log(`  Title: ${issue.title}`);

const body = issue.body ?? '';

// Parse area and priority from form body
const areaRaw     = parseFormField(body, 'Area');
const priorityRaw = parseFormField(body, 'Suggested priority', 'Severity', 'Priority');

// Normalize: strip any parenthetical descriptions ("P1-High (next sprint)" → "P1-High")
const normalize = s => s?.replace(/\s*\(.*\)/, '').trim() ?? null;

const area     = normalize(areaRaw);
const priority = normalize(priorityRaw);

console.log(`  Area: ${area ?? '(not set)'}`);
console.log(`  Priority: ${priority ?? '(not set)'}`);

// ── Add to project ────────────────────────────────────────────────────────────

let itemId = null;

if (!DRY_RUN) {
  const addResult = gql(`mutation {
    addProjectV2ItemById(input: {
      projectId: "${PROJECT_ID}"
      contentId: "${issue.url.replace('https://github.com/', '')}"
    }) { item { id } }
  }`).catch(() => null);

  // Use gh CLI as fallback (handles node ID resolution automatically)
  try {
    const added = gh('project', 'item-add', String(PROJECT_NUM),
      '--owner', OWNER,
      '--url', issue.url,
      '--format', 'json',
    );
    itemId = JSON.parse(added.stdout).id;
    console.log(`  Added to project: ${itemId}`);
  } catch (err) {
    console.warn(`  Could not add to project: ${err.message}`);
  }
}

// ── Set project fields ────────────────────────────────────────────────────────

if (!DRY_RUN && itemId) {
  function setField(fieldKey, value) {
    const fieldId  = ids.fieldIds?.[fieldKey];
    const optionId = value ? ids.fieldOptions?.[fieldKey]?.[value] : null;
    if (!fieldId || !optionId) return;
    try {
      gql(`mutation {
        updateProjectV2ItemFieldValue(input: {
          projectId: "${PROJECT_ID}"
          itemId: "${itemId}"
          fieldId: "${fieldId}"
          value: { singleSelectOptionId: "${optionId}" }
        }) { projectV2Item { id } }
      }`);
      console.log(`  Set ${fieldKey} = ${value}`);
    } catch (err) {
      console.warn(`  Could not set ${fieldKey}: ${err.message}`);
    }
  }

  setField('status', 'Todo');
  if (area)     setField('area', area);
  if (priority) setField('priority', priority);
} else if (DRY_RUN) {
  console.log(`  [dry] Would add #${ISSUE_NUMBER} to project #${PROJECT_NUM}`);
  console.log(`  [dry] Would set Status=Todo, Area=${area}, Priority=${priority}`);
}

console.log('Done.');
