#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),STATE_DIR=path.join(ROOT,'.kosame-state');
const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));

// Get current git hash
var gitHash='unknown';
try{
  gitHash=cp.spawnSync('git',['rev-parse','--short','HEAD'],{cwd:ROOT,encoding:'utf8',timeout:5000}).stdout.trim();
}catch(_){}

// Write last-known-good
fs.mkdirSync(STATE_DIR,{recursive:true});
fs.writeFileSync(path.join(STATE_DIR,'last-known-good.json'),JSON.stringify({
  version:pkg.version,commit:gitHash,timestamp:new Date().toISOString(),
  verify_hint:'npm run verify',ops_validate_hint:'npm run ops:validate',
},null,2)+'\n');
console.log('Last known good: v'+pkg.version+' ('+gitHash+')');

// Write recovery guide
const guide=[
  '# KOSAME Dev Orchestra Recovery Guide','',
  '## Quick Recovery','',
  '- 1. Check current status: `npm run ops:validate`',
  '- 2. Restore canonical test.html: `npm run smoke:cleanup`',
  '- 3. Verify all smokes: `npm run verify`',
  '- 4. Check last known good: `.kosame-state/last-known-good.json`',
  '',
  '## Rollback Steps','',
  '- 1. `git log --oneline -5` to see recent commits',
  '- 2. `git reset --soft` to unstage if needed',
  '- 3. `git checkout public/test.html` if smoke residue',
  '- 4. `git checkout package.json` if version issue',
  '- 5. `npm run verify` to confirm rollback success',
  '',
  '## Generated Files','',
  '- .kosame-executor/* (generated, not committed)',
  '- .kosame-runner/ (runtime state)',
  '- .kosame-state/ (last known good)',
  '- .kosame-logs/ (operational logs)',
  '',
  '## Never Destroy','',
  '- .env / credentials / Secret files',
  '- /home/lavie/repos/kosame-sales-dx',
  '- /home/lavie/repos/transcriber',
  '- Customer data / Insurance logic',
  '- FK大宮LP / KOSAME LP assets',
  '',
  `generated_at: ${new Date().toISOString()}`,'',
].join('\n');
fs.writeFileSync(path.join(ROOT,'docs','recovery-guide.md'),guide);
console.log('Recovery guide written to docs/recovery-guide.md');
