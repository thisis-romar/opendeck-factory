#!/usr/bin/env node
// One-time setup: creates the GitHub Projects v2 board + custom fields.
// Detects and reuses built-in fields (Status is a reserved name in Projects v2).
// Run once after `gh auth refresh -s project`.
// Writes .github/project-ids.json for use by gh-project-sync.js.
// Run: node scripts/gh-project-setup.js

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('data/project-items.json', 'utf8'));
const { owner, title } = config.project;

function ghRaw(args) {
  return execSync(`gh ${args}`, { encoding: 'utf8' }).trim();
}

// ── 1. Create project ─────────────────────────────────────────────────────────
console.log(`Creating project "${title}" for @${owner}...`);
const createOut = ghRaw(`project create --owner ${owner} --title "${title}" --format json`);
const { number: projectNumber, id: projectId } = JSON.parse(createOut);
console.log(`  ✓ Project #${projectNumber} (id: ${projectId})`);

// ── 2. Read existing built-in fields ─────────────────────────────────────────
// Projects v2 ships with reserved fields (Status, Title, Assignees, etc.).
// Attempting to create a field named "Status" throws a GraphQL reserved-name error.
// We query existing fields first and reuse any that match by name.
const existingRaw = ghRaw(`project field-list ${projectNumber} --owner ${owner} --format json`);
const existingFields = JSON.parse(existingRaw).fields ?? JSON.parse(existingRaw);
const existingByName = {};
for (const f of existingFields) existingByName[f.name.toLowerCase()] = f.id;
console.log(`  Built-in fields found: ${Object.keys(existingByName).join(', ')}`);

// ── 3. Create missing custom fields ──────────────────────────────────────────
const fieldIds = {};

for (const field of config.fields) {
  const key = field.name.toLowerCase();
  if (existingByName[key]) {
    // Reuse existing (e.g. built-in Status field)
    fieldIds[key] = existingByName[key];
    console.log(`  ↩ Reused existing field "${field.name}" (id: ${fieldIds[key]})`);
  } else {
    const opts = field.options.map(o => `"${o}"`).join(',');
    const raw = ghRaw(
      `project field-create ${projectNumber} --owner ${owner} --name "${field.name}" --data-type ${field.type} --single-select-options ${opts} --format json`
    );
    const { id } = JSON.parse(raw);
    fieldIds[key] = id;
    console.log(`  ✓ Created field "${field.name}" (id: ${id})`);
  }
}

// ── 4. Write IDs file ─────────────────────────────────────────────────────────
mkdirSync('.github', { recursive: true });
const idsPath = join('.github', 'project-ids.json');
writeFileSync(idsPath, JSON.stringify({ projectNumber, projectId, fieldIds }, null, 2));
console.log(`\nWrote ${idsPath}`);
console.log(`\nDone. Run: node scripts/gh-project-sync.js`);
