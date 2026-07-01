#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),MIN_VERSION='113.3.128',STATE_DIR=path.join(ROOT,'.kosame-state');
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}

console.log('===== v'+MIN_VERSION+' recovery smoke =====');
t('version >= '+MIN_VERSION,()=>{const pa=PKG.version.split('.').map(Number),pb=MIN_VERSION.split('.').map(Number);a(pa[0]*10000+pa[1]*100+pa[2]>=pb[0]*10000+pb[1]*100+pb[2])});

var r=cp.spawnSync(process.execPath,[path.join(ROOT,'tools/kosame-recovery-keeper.js')],{cwd:ROOT,encoding:'utf8',timeout:10000});
t('recovery keeper runs',()=>{a((r.stdout||'').includes('Last known good'))});

t('last-known-good.json exists',()=>{a(fs.existsSync(path.join(STATE_DIR,'last-known-good.json')))});
t('last-known-good has version',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'last-known-good.json'),'utf8')).version)});
t('last-known-good has commit',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'last-known-good.json'),'utf8')).commit)});
t('last-known-good has verify_hint',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'last-known-good.json'),'utf8')).verify_hint.includes('verify'))});
t('recovery-guide.md exists',()=>{a(fs.existsSync(path.join(ROOT,'docs','recovery-guide.md')))});
t('recovery-guide has rollback steps',()=>{a(rd('docs/recovery-guide.md').includes('Rollback'))});
t('recovery-guide has npm run verify',()=>{a(rd('docs/recovery-guide.md').includes('npm run verify'))});
t('recovery-guide has forbidden sections',()=>{a(rd('docs/recovery-guide.md').includes('Never Destroy'))});
t('gitignore: .kosame-state/',()=>{a(rd('.gitignore').includes('.kosame-state/')||rd('.gitignore').includes('.kosame-state'))});
t('gitignore: .kosame-logs/',()=>{a(rd('.gitignore').includes('.kosame-logs/')||rd('.gitignore').includes('.kosame-logs'))});

var total=p+f;console.log('');
if(f===0){console.log('✅ v'+MIN_VERSION+' smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ v'+MIN_VERSION+' smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
