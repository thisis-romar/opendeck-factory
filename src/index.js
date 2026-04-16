import { resolve } from 'node:path';
import { extract } from './extract.js';
import { pack } from './pack.js';
import { validate } from './validate.js';
import { ProfileEditor } from './profile.js';

const [,, command, ...args] = process.argv;

function usage() {
  console.log(`Usage:
  node src/index.js extract <profile.streamDeckProfile> [outputDir]
  node src/index.js pack <sourceDir> <output.streamDeckProfile>
  node src/index.js validate <sourceDir>
  node src/index.js list <sourceDir>`);
  process.exit(1);
}

switch (command) {
  case 'extract': {
    const profilePath = args[0];
    const outputDir = args[1] || '_extracted';
    if (!profilePath) usage();
    extract(resolve(profilePath), resolve(outputDir));
    break;
  }

  case 'pack': {
    const sourceDir = args[0] || '_extracted';
    const outputPath = args[1];
    if (!outputPath) usage();
    pack(resolve(sourceDir), resolve(outputPath));
    break;
  }

  case 'validate': {
    const sourceDir = args[0] || '_extracted';
    const result = validate(resolve(sourceDir));
    if (result.valid) {
      console.log('Validation passed.');
    } else {
      console.error('Validation failed:');
      for (const err of result.errors) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }
    break;
  }

  case 'list': {
    const sourceDir = args[0] || '_extracted';
    const editor = new ProfileEditor(resolve(sourceDir));
    const { cols, rows } = editor.deviceInfo;

    console.log(`Profile: "${editor.profileManifest.Name}"`);
    console.log(`Device: ${editor.deviceInfo.name} (${cols}x${rows})`);
    console.log();

    for (const pageUUID of editor.getPageUUIDs()) {
      const manifest = editor.getPageManifest(pageUUID);
      console.log(`Page: "${manifest.Name || '(unnamed)'}" [${pageUUID}]`);

      const actions = editor.getActions(pageUUID);
      if (!actions || Object.keys(actions).length === 0) {
        console.log('  (empty)');
        continue;
      }

      // Print grid
      for (let row = 0; row < rows; row++) {
        const cells = [];
        for (let col = 0; col < cols; col++) {
          const action = actions[`${col},${row}`];
          if (action) {
            const title = (action.States?.[0]?.Title || '').replace(/\n/g, ' ').trim();
            cells.push(title.padEnd(14));
          } else {
            cells.push('---'.padEnd(14));
          }
        }
        console.log(`  Row ${row}: | ${cells.join(' | ')} |`);
      }
      console.log();
    }
    break;
  }

  default:
    usage();
}
