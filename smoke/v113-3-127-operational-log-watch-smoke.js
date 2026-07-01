#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),MIN_VERSION='113.3.127',LOG_DIR=path.join(ROOT,'.kosame-logs');
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}

console.log('===== v'+MIN_VERSION+' operational log watch smoke =====');
t('version >= '+MIN_VERSION,()=>{const pa=PKG.version.split('.').map(Number),pb=MIN_VERSION.split('.').map(Number);a(pa[0]*10000+pa[1]*100+pa[2]>=pb[0]*10000+pb[1]*100+pb[2])});

// Run logger
var r=cp.spawnSync(process.execPath,[path.join(ROOT,'tools/kosame-operational-logger.js')],{cwd:ROOT,encoding:'utf8',timeout:15000});
var out=(r.stdout||'');
t('logger runs',()=>{a(out.includes('KOSAME_OPERATIONAL_LOG'),'no marker')});

// Log directory exists
t('log dir exists',()=>{a(fs.existsSync(LOG_DIR))});
t('logs generated',()=>{var files=fs.readdirSync(LOG_DIR).filter(function(f){return f.endsWith('.json')});a(files.length>=5,'only '+files.length+' logs')});

// Log format check
t('log files have timestamp',()=>{
  var files=fs.readdirSync(LOG_DIR).filter(function(f){return f.endsWith('.json')});
  files.forEach(function(fn){a(fn.match(/^\d{4}-\d{2}-\d{2}/),'bad name: '+fn)});
});

t('log files have type field',()=>{
  var files=fs.readdirSync(LOG_DIR).filter(function(f){return f.endsWith('.json')}).slice(0,3);
  files.forEach(function(fn){
    var data=JSON.parse(fs.readFileSync(path.join(LOG_DIR,fn),'utf8'));
    a(data.type,'no type in '+fn);
  });
});

// Logger tool exists
t('operational-logger exists',()=>{a(fs.existsSync(path.join(ROOT,'tools/kosame-operational-logger.js')))});

// .kosame-logs in gitignore
t('gitignore: .kosame-logs/',()=>{
  var gi=rd('.gitignore');
  a(gi.includes('.kosame-logs/')||gi.includes('.kosame-logs'),'not in gitignore');
});

var total=p+f;console.log('');
if(f===0){console.log('✅ v'+MIN_VERSION+' smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ v'+MIN_VERSION+' smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
