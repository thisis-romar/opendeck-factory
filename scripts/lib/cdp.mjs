/**
 * Shared Edge/CDP helpers for Playwright-driven GitHub automation scripts.
 * Both gh-create-views.mjs and gh-toggle-workflows.mjs import from here.
 */
import { existsSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';

export const CDP_PORT = 9222;
export const EDGE_USER_DATA = path.join(
  os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data'
);

export function getEdgePath() {
  const candidates = [
    path.join(process.env['ProgramFiles(x86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ];
  for (const p of candidates) { if (existsSync(p)) return p; }
  return 'msedge.exe';
}

export function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

export async function waitForCDP(maxWait = 30_000, port = CDP_PORT) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const resp = await httpGet(`http://127.0.0.1:${port}/json/version`);
      if (resp.status === 200) return JSON.parse(resp.data);
    } catch { /* not ready */ }
    await delay(1000);
  }
  throw new Error(`CDP endpoint not ready on port ${port} after ${maxWait / 1000}s`);
}

/**
 * Launch Edge with remote debugging on CDP_PORT (or reuse existing session).
 * @param {string} initialUrl  URL to open on launch (e.g. the GitHub project URL)
 * @param {object} opts
 * @param {number} [opts.port]         CDP port (default: CDP_PORT)
 * @param {string} [opts.userDataDir]  Edge profile directory (default: EDGE_USER_DATA)
 */
export async function launchEdgeWithCDP(initialUrl, { port = CDP_PORT, userDataDir = EDGE_USER_DATA } = {}) {
  try {
    await waitForCDP(3000, port);
    console.log(`  CDP already open on port ${port}`);
    return;
  } catch { /* not running, launch it */ }

  console.log('  Closing Edge...');
  try { execSync('taskkill.exe /F /IM msedge.exe', { stdio: 'pipe' }); } catch { /* not running */ }
  await delay(1500);

  console.log('  Launching Edge with remote debugging...');
  const proc = spawn(getEdgePath(), [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    initialUrl,
  ], { detached: true, stdio: 'ignore' });
  proc.unref();

  await waitForCDP(60_000, port);
  console.log('  Edge CDP ready.');
}

/**
 * Take a labelled screenshot for debugging, silently swallowing failures.
 * @param {import('playwright').Page} page
 * @param {string} name   filename stem (no extension)
 * @param {string} dir    directory to write to
 */
export async function screenshot(page, name, dir) {
  mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false, timeout: 10_000, animations: 'disabled' })
    .catch(err => console.warn(`  [screenshot failed] ${name}: ${err.message}`));
  console.log(`  [screenshot] ${p}`);
}

export function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
