#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),MIN_VERSION='113.9.6';
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}

console.log('===== v'+MIN_VERSION+' memory system smoke =====');
t('version >= '+MIN_VERSION,()=>{const pa=PKG.version.split('.').map(Number),pb=MIN_VERSION.split('.').map(Number);a(pa[0]*10000+pa[1]*100+pa[2]>=pb[0]*10000+pb[1]*100+pb[2])});

// ── Module exists ────────────────────────────────────────────────────────
t('tools: kosame-memory.js exists',()=>{a(fs.existsSync(path.join(ROOT,'tools','kosame-memory.js')))});

// ── Module exports ───────────────────────────────────────────────────────
var memMod = require(path.join(ROOT,'tools','kosame-memory'));
t('export: loadMemory',()=>{a(typeof memMod.loadMemory==='function')});
t('export: formatMemoryForContext',()=>{a(typeof memMod.formatMemoryForContext==='function')});
t('export: MEMORY_FILE',()=>{a(memMod.MEMORY_FILE.includes('.kosame-state')&&memMod.MEMORY_FILE.includes('memory.json'))});
t('export: DEFAULT_MEMORY',()=>{a(memMod.DEFAULT_MEMORY&&Array.isArray(memMod.DEFAULT_MEMORY.entries))});

// ── Memory file exists ──────────────────────────────────────────────────
t('file: .kosame-state/memory.json exists',()=>{a(fs.existsSync(memMod.MEMORY_FILE))});

// ── Memory content ──────────────────────────────────────────────────────
var mem = memMod.loadMemory();
t('memory: has entries array',()=>{a(Array.isArray(mem.entries))});
t('memory: has >= 3 entries',()=>{a(mem.entries.length>=3)});
t('memory: sales_dx_status present',()=>{a(mem.entries.some(function(e){return e.key==='sales_dx_status'}))});
t('memory: sales_dx entry mentions v0.8.0',()=>{var e=mem.entries.find(function(x){return x.key==='sales_dx_status'});a(e&&e.value.includes('v0.8.0'))});
t('memory: model_priority present',()=>{a(mem.entries.some(function(e){return e.key==='model_priority'}))});
t('memory: model entry mentions Claude→Gemini→Llama',()=>{var e=mem.entries.find(function(x){return x.key==='model_priority'});a(e&&(e.value.includes('Claude')&&e.value.includes('Gemini')&&e.value.includes('Llama')))});
t('memory: fk_omiya_repo present',()=>{a(mem.entries.some(function(e){return e.key==='fk_omiya_repo'}))});
t('memory: fk_omiya entry mentions 別リポジトリ',()=>{var e=mem.entries.find(function(x){return x.key==='fk_omiya_repo'});a(e&&e.value.includes('別'))});

// ── Format for context ──────────────────────────────────────────────────
t('format: returns non-empty string',()=>{var s=memMod.formatMemoryForContext(mem);a(typeof s==='string'&&s.length>0)});
t('format: contains KOSAME Memory',()=>{var s=memMod.formatMemoryForContext(mem);a(s.includes('KOSAME Memory'))});

// ── Source integration in chat-gpt ───────────────────────────────────────
var gptSrc = rd('tools/kosame-chat-gpt.js');
t('gpt: imports kosame-memory',()=>{a(gptSrc.includes("require('./kosame-memory')"))});
t('gpt: calls loadMemory',()=>{a(gptSrc.includes('loadMemory()'))});
t('gpt: calls formatMemoryForContext',()=>{a(gptSrc.includes('formatMemoryForContext'))});

// ── .gitignore check ────────────────────────────────────────────────────
var gitignore = rd('.gitignore');
t('gitignore: .kosame-state/',()=>{a(gitignore.includes('.kosame-state/'))});

// ── Package ──────────────────────────────────────────────────────────────
t('pkg: smoke:v113-9-6',()=>{a(PKG.scripts['smoke:v113-9-6'])});
t('pkg: verify includes v113-9-6',()=>{a(PKG.scripts['verify:dev-os']&&PKG.scripts['verify:dev-os'].includes('smoke:v113-9-6'))});

var total=p+f;console.log('');
if(f===0){console.log('✅ v'+MIN_VERSION+' smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ v'+MIN_VERSION+' smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
