#!/usr/bin/env node
// MCP server for opendeck-factory — exposes 7 tools via stdio transport.
// Usage: node src/mcp-server.js
// Claude Desktop config: { "command": "node", "args": ["<abs-path>/src/mcp-server.js"] }

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extract } from './extract.js';
import { pack } from './pack.js';
import { validate } from './validate.js';

// Grid dimensions keyed by Device.Model from root manifest.json.
// Fallback covers any unknown model conservatively with the largest known grid (XL: 8×4).
const DEVICE_GRID = {
  '20GBA9901': { cols: 5, rows: 3 }, // MK.2
  '20GAT9901': { cols: 8, rows: 4 }, // XL
  '20GAI9901': { cols: 3, rows: 2 }, // Mini
  '20GBD9901': { cols: 4, rows: 2 }, // Stream Deck +
  '20GBJ9901': { cols: 4, rows: 2 }, // Neo
};
const FALLBACK_GRID = { cols: 8, rows: 4 };
import { ProfileEditor } from './profile.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

const server = new McpServer({
  name: 'opendeck-factory',
  version: JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version,
});

// ── Tool 1: extract_profile ───────────────────────────────────────────────────
server.tool(
  'extract_profile',
  'Extract a .streamDeckProfile ZIP to an editable directory',
  {
    profile_path: z.string().describe('Absolute path to the .streamDeckProfile file'),
    output_dir: z.string().describe('Absolute path to the output directory'),
  },
  async ({ profile_path, output_dir }) => {
    try {
      extract(resolve(profile_path), resolve(output_dir));
      return { content: [{ type: 'text', text: `Extracted to: ${output_dir}` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Tool 2: pack_profile ──────────────────────────────────────────────────────
server.tool(
  'pack_profile',
  'Pack an extracted profile directory back to a .streamDeckProfile ZIP',
  {
    source_dir: z.string().describe('Absolute path to the extracted profile directory'),
    output_path: z.string().describe('Absolute path for the output .streamDeckProfile file'),
  },
  async ({ source_dir, output_path }) => {
    try {
      pack(resolve(source_dir), resolve(output_path));
      return { content: [{ type: 'text', text: `Packed to: ${output_path}` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Tool 3: validate_profile ──────────────────────────────────────────────────
server.tool(
  'validate_profile',
  'Validate an extracted profile directory — checks structure, manifests, image refs, and grid bounds',
  {
    source_dir: z.string().describe('Absolute path to the extracted profile directory'),
  },
  async ({ source_dir }) => {
    try {
      const result = validate(resolve(source_dir));
      if (result.valid) {
        return { content: [{ type: 'text', text: 'Validation passed.' }] };
      }
      return {
        content: [{ type: 'text', text: `Validation failed:\n${result.errors.map(e => `  - ${e}`).join('\n')}` }],
        isError: true,
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Tool 4: list_profile ──────────────────────────────────────────────────────
server.tool(
  'list_profile',
  'Show the button grid layout of an extracted profile — all pages, rows, and button labels',
  {
    source_dir: z.string().describe('Absolute path to the extracted profile directory'),
  },
  async ({ source_dir }) => {
    try {
      const editor = new ProfileEditor(resolve(source_dir));
      const { cols, rows } = editor.deviceInfo;
      const lines = [];

      lines.push(`Profile: "${editor.profileManifest.Name}"`);
      lines.push(`Device: ${editor.deviceInfo.name} (${cols}x${rows})`);

      for (const pageUUID of editor.getPageUUIDs()) {
        const manifest = editor.getPageManifest(pageUUID);
        lines.push(`\nPage: "${manifest.Name || '(unnamed)'}" [${pageUUID}]`);

        const actions = editor.getActions(pageUUID);
        if (!actions || Object.keys(actions).length === 0) {
          lines.push('  (empty)');
          continue;
        }

        for (let row = 0; row < rows; row++) {
          const cells = [];
          for (let col = 0; col < cols; col++) {
            const action = actions[`${col},${row}`];
            const title = action ? (action.States?.[0]?.Title || '').replace(/\n/g, ' ').trim() : '---';
            cells.push(title.padEnd(14));
          }
          lines.push(`  Row ${row}: | ${cells.join(' | ')} |`);
        }
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Tool 5: add_shortcut ──────────────────────────────────────────────────────
server.tool(
  'add_shortcut',
  'Add a hotkey button to a profile page at a specific grid position',
  {
    source_dir: z.string().describe('Absolute path to the extracted profile directory'),
    page_uuid: z.string().describe('Page UUID (get from list_profile)'),
    col: z.number().int().min(0).describe('Column (0-indexed)'),
    row: z.number().int().min(0).describe('Row (0-indexed)'),
    label: z.string().describe('Button label (use \\n for line breaks, max 3 lines)'),
    key: z.string().describe('Key name (e.g. "A", "F5", "UP", "ENTER") — must be in KEY_CODES'),
    ctrl: z.boolean().optional().describe('Ctrl modifier'),
    shift: z.boolean().optional().describe('Shift modifier'),
    alt: z.boolean().optional().describe('Alt modifier'),
    win: z.boolean().optional().describe('Win/Cmd modifier'),
    image_path: z.string().optional().describe('Absolute path to a 144x144 icon image (PNG or SVG)'),
  },
  async ({ source_dir, page_uuid, col, row, label, key, ctrl, shift, alt, win, image_path }) => {
    try {
      const absDir = resolve(source_dir);
      const rootManifest = JSON.parse(readFileSync(join(absDir, 'manifest.json'), 'utf8'));
      const model = rootManifest?.Device?.Model;
      const grid = DEVICE_GRID[model] ?? FALLBACK_GRID;
      if (col >= grid.cols || row >= grid.rows) {
        return {
          content: [{ type: 'text', text: `Position ${col},${row} is out of bounds for device ${model ?? 'unknown'} (grid: ${grid.cols}×${grid.rows}, max col ${grid.cols - 1}, max row ${grid.rows - 1})` }],
          isError: true,
        };
      }
      const editor = new ProfileEditor(absDir);
      editor.addHotkeyButton(page_uuid, col, row, {
        label, key, ctrl, shift, alt, win,
        imagePath: image_path ? resolve(image_path) : undefined,
      });
      editor.save();
      return { content: [{ type: 'text', text: `Added "${label}" (${key}) at ${col},${row} on page ${page_uuid}` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Tool 6: generate_icons ────────────────────────────────────────────────────
server.tool(
  'generate_icons',
  'Generate color-coded SVG icons for all shortcuts in a data/shortcuts/<app>.json file',
  {
    app_name: z.string().describe('App name matching the shortcuts file (e.g. "vs-code")'),
    shortcuts_dir: z.string().optional().describe('Directory containing shortcuts JSON files (default: <repo-root>/data/shortcuts/)'),
    icons_dir: z.string().optional().describe('Output directory for icons (default: <repo-root>/data/icons/<app-name>/)'),
  },
  async ({ app_name, shortcuts_dir, icons_dir }) => {
    try {
      const env = { ...process.env };
      const args = [join(ROOT, 'scripts/generate-icons.js'), app_name];
      if (shortcuts_dir) env.SHORTCUTS_DIR = resolve(shortcuts_dir);
      if (icons_dir) env.ICONS_DIR = resolve(icons_dir);

      const output = execFileSync(process.execPath, args, { cwd: ROOT, env, encoding: 'utf8' });
      return { content: [{ type: 'text', text: output.trim() }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Tool 7: list_shortcuts ────────────────────────────────────────────────────
server.tool(
  'list_shortcuts',
  'Read and return the shortcut definitions for an app from data/shortcuts/<app>.json',
  {
    app_name: z.string().describe('App name (e.g. "vs-code")'),
    shortcuts_dir: z.string().optional().describe('Directory containing shortcuts JSON files (default: <repo-root>/data/shortcuts/)'),
  },
  async ({ app_name, shortcuts_dir }) => {
    try {
      const dir = shortcuts_dir ? resolve(shortcuts_dir) : join(ROOT, 'data/shortcuts');
      const filePath = join(dir, `${app_name}.json`);
      if (!existsSync(filePath)) {
        return { content: [{ type: 'text', text: `Shortcuts file not found: ${filePath}` }], isError: true };
      }
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      const lines = [`App: ${data.app || app_name}`, `Shortcuts: ${data.shortcuts?.length ?? 0}`];
      for (const s of data.shortcuts || []) {
        lines.push(`  [${s.category}] ${s.command}: ${s.key}${s.modifiers ? ` (${Object.entries(s.modifiers).filter(([,v]) => v).map(([k]) => k).join('+')})` : ''}`);
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
