#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),MIN_VERSION='113.3.130';
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}

console.log('===== v'+MIN_VERSION+' handoff pack smoke =====');
t('version >= '+MIN_VERSION,()=>{const pa=PKG.version.split('.').map(Number),pb=MIN_VERSION.split('.').map(Number);a(pa[0]*10000+pa[1]*100+pa[2]>=pb[0]*10000+pb[1]*100+pb[2])});

// Check docs exist
t('phase1-completion.md exists',()=>{a(fs.existsSync(path.join(ROOT,'docs','phase1-completion.md')))});
t('recovery-guide.md exists',()=>{a(fs.existsSync(path.join(ROOT,'docs','recovery-guide.md')))});

// Check docs content
var pc=rd('docs/phase1-completion.md');
t('phase1: has version',()=>{a(pc.includes('v113.3.130'))});
t('phase1: has start instructions',()=>{a(pc.includes('npm run')||pc.includes('npm start'))});
t('phase1: has verification',()=>{a(pc.includes('verify')||pc.includes('smoke'))});
t('phase1: has Phase 2-13',()=>{a(pc.includes('Phase 2')||pc.includes('v114')||pc.includes('v115'))});
t('phase1: has known limitations',()=>{a(pc.includes('Limitation')||pc.includes('limitation')||pc.includes('Known'))});
t('phase1: has forbidden',()=>{a(pc.includes('Forbidden')||pc.includes('Never'))});

// Check roadmap canon exists
var rp=path.join(ROOT,'.kosame-executor','kosame-roadmap-canon.json');
t('roadmap canon exists',()=>{a(fs.existsSync(rp))});

// Check recovery guide content
var rg=rd('docs/recovery-guide.md');
t('recovery: has rollback',()=>{a(rg.includes('Rollback'))});
t('recovery: has quick recovery',()=>{a(rg.includes('Recovery')||rg.includes('recovery'))});
t('recovery: has never destroy',()=>{a(rg.includes('Destroy')||rg.includes('Never'))});

// Check operational tools exist
var tools=['kosame-operational-logger.js','kosame-recovery-keeper.js','kosame-rc-freeze-check.js','kosame-roadmap-manager.js','kosame-smoke-cleanup.js'];
tools.forEach(function(tool){
  t('tool: '+tool,()=>{a(fs.existsSync(path.join(ROOT,'tools',tool)))});
});

// Check smoke scripts registered
['v113-3-126','v113-3-127','v113-3-128','v113-3-129','v113-3-130'].forEach(function(v){
  t('smoke: '+v,()=>{a(PKG.scripts['smoke:'+v])});
});

var total=p+f;console.log('');
if(f===0){console.log('✅ v'+MIN_VERSION+' smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ v'+MIN_VERSION+' smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
