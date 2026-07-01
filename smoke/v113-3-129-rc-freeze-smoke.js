#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),MIN_VERSION='113.3.129';
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}

console.log('===== v'+MIN_VERSION+' rc freeze smoke =====');
t('version >= '+MIN_VERSION,()=>{const pa=PKG.version.split('.').map(Number),pb=MIN_VERSION.split('.').map(Number);a(pa[0]*10000+pa[1]*100+pa[2]>=pb[0]*10000+pb[1]*100+pb[2])});

// Check all smoke scripts registered
var versions=['v113-3-96','v113-3-112','v113-3-114','v113-3-115','v113-3-116','v113-3-117','v113-3-118','v113-3-119','v113-3-120','v113-3-121','v113-3-122','v113-3-123','v113-3-124','v113-3-125','v113-3-126','v113-3-127','v113-3-128','v113-3-129','v113-3-130'];
versions.forEach(function(v){
  t('smoke registered: '+v,()=>{a(PKG.scripts&&PKG.scripts['smoke:'+v]||PKG.scripts['smoke:'+v.replace('v','')],'missing: smoke:'+v)});
});

// Check verify includes all
t('verify:dev-os exists',()=>{a(PKG.scripts['verify:dev-os'])});

// Check RC tools exist
t('rc-freeze-check exists',()=>{a(fs.existsSync(path.join(ROOT,'tools/kosame-rc-freeze-check.js')))});
t('operational-logger exists',()=>{a(fs.existsSync(path.join(ROOT,'tools/kosame-operational-logger.js')))});
t('recovery-keeper exists',()=>{a(fs.existsSync(path.join(ROOT,'tools/kosame-recovery-keeper.js')))});

var total=p+f;console.log('');
if(f===0){console.log('✅ v'+MIN_VERSION+' smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ v'+MIN_VERSION+' smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
