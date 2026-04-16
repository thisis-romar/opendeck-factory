import { resolve } from 'node:path';
import { ProfileEditor } from '../src/profile.js';

const extractedDir = resolve('profiles/vs-code');
const editor = new ProfileEditor(extractedDir);

// Find the active page with actions (EBFEE41E...)
const pages = editor.getPageUUIDs();
let fixed = false;

for (const pageUUID of pages) {
  const action = editor.getAction(pageUUID, 1, 1);
  if (action && action.States?.[0]?.Title === "Pannel\n") {
    console.log(`Found typo at position 1,1 on page "${editor.getPageManifest(pageUUID).Name}"`);
    editor.updateTitle(pageUUID, 1, 1, "Panel\n");
    console.log('Fixed: "Pannel" → "Panel"');
    fixed = true;
  }
}

if (fixed) {
  editor.save();
} else {
  console.log('No typo found (already fixed or not present).');
}
