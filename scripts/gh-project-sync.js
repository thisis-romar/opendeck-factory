#!/usr/bin/env node
// Idempotent sync: creates GitHub issues + adds them to the Projects v2 board.
// Re-running is safe — existing issues are detected by exact title match and skipped.
// Requires .github/project-ids.json from gh-project-setup.js.
// Run: node scripts/gh-project-sync.js

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const config = JSON.parse(readFileSync('data/project-items.json', 'utf8'));
const ids = JSON.parse(readFileSync('.github/project-ids.json', 'utf8'));

const { owner, repo } = config.project;
const { projectNumber, projectId, fieldIds } = ids;

function ghRaw(args) {
  return execSync(`gh ${args}`, { encoding: 'utf8' }).trim();
}

// Build option-name → option-id map for each custom field
function buildOptionMaps() {
  const raw = ghRaw(`project field-list ${projectNumber} --owner ${owner} --format json`);
  const fields = JSON.parse(raw).fields ?? JSON.parse(raw);
  const maps = {};
  for (const field of fields) {
    if (!field.options) continue;
    maps[field.name.toLowerCase()] = {};
    for (const opt of field.options) {
      maps[field.name.toLowerCase()][opt.name] = opt.id;
    }
  }
  return maps;
}

// Get all existing issues indexed by title for dedup
function getExistingIssues() {
  const raw = ghRaw(`issue list --repo ${owner}/${repo} --state all --limit 200 --json number,title,url`);
  const issues = JSON.parse(raw);
  const map = {};
  for (const i of issues) map[i.title] = { number: i.number, url: i.url };
  return map;
}

// Set a single-select field value on a project item
function setField(itemId, fieldId, optionId) {
  if (!fieldId || !optionId) return;
  ghRaw(`project item-edit --id ${itemId} --project-id ${projectId} --field-id ${fieldId} --single-select-option-id ${optionId}`);
}

// Ensure all labels referenced in project-items.json exist in the repo
function ensureLabels() {
  const needed = new Set(config.items.flatMap(i => i.labels ?? []));
  const existingRaw = ghRaw(`label list --repo ${owner}/${repo} --json name`);
  const existing = new Set(JSON.parse(existingRaw).map(l => l.name));
  const colors = { enhancement: '84b6eb', distribution: '0075ca', release: 'e11d48', devops: 'f9d0c4', research: 'd4c5f9' };
  for (const label of needed) {
    if (!existing.has(label)) {
      const color = colors[label] ?? 'ededed';
      ghRaw(`label create "${label}" --repo ${owner}/${repo} --color ${color}`);
      console.log(`  ✓ Created label "${label}"`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('Ensuring labels exist...');
ensureLabels();

console.log('Building option maps...');
const optMaps = buildOptionMaps();

console.log('Fetching existing issues...');
const existing = getExistingIssues();

// Fetch current board items to avoid duplicate additions
const itemsRaw = ghRaw(`project item-list ${projectNumber} --owner ${owner} --format json --limit 200`);
const itemsData = JSON.parse(itemsRaw);
const boardItems = itemsData.items ?? itemsData;
const boardUrls = new Set(boardItems.map(i => i.content?.url).filter(Boolean));

let created = 0, skipped = 0, added = 0;
const tmpFile = join(tmpdir(), 'gh-issue-body.md');

for (const item of config.items) {
  let issueUrl;

  if (existing[item.title]) {
    issueUrl = existing[item.title].url;
    console.log(`  — Exists: #${existing[item.title].number} ${item.title}`);
    skipped++;
  } else {
    // Write body to temp file to avoid shell escaping issues
    writeFileSync(tmpFile, item.body ?? '', 'utf8');
    const labelFlag = item.labels?.length ? `--label "${item.labels[0]}"` : '';
    const url = ghRaw(
      `issue create --repo ${owner}/${repo} --title "${item.title.replace(/"/g, '\\"')}" --body-file "${tmpFile}" ${labelFlag}`
    );
    issueUrl = url;
    const issueNumber = url.split('/').pop();
    if (item.closed) ghRaw(`issue close ${issueNumber} --repo ${owner}/${repo}`);
    console.log(`  ✓ Created #${issueNumber}: ${item.title}${item.closed ? ' (closed)' : ''}`);
    created++;
  }

  // Add to board if not already present
  if (!boardUrls.has(issueUrl)) {
    const addRaw = ghRaw(`project item-add ${projectNumber} --owner ${owner} --url ${issueUrl} --format json`);
    const { id: itemId } = JSON.parse(addRaw);

    setField(itemId, fieldIds['status'],   optMaps['status']?.[item.status]);
    setField(itemId, fieldIds['priority'], optMaps['priority']?.[item.priority]);
    setField(itemId, fieldIds['area'],     optMaps['area']?.[item.area]);
    setField(itemId, fieldIds['target'],   optMaps['target']?.[item.target]);

    boardUrls.add(issueUrl);
    added++;
  }
}

try { unlinkSync(tmpFile); } catch {}

console.log(`\nDone. Created: ${created}  Skipped: ${skipped}  Added to board: ${added}`);
console.log(`View: gh project view ${projectNumber} --owner ${owner} --web`);
