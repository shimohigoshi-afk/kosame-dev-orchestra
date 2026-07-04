#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),MIN_VERSION='113.9.5';
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}

console.log('===== v'+MIN_VERSION+' chat history persistence smoke =====');
t('version >= '+MIN_VERSION,()=>{const pa=PKG.version.split('.').map(Number),pb=MIN_VERSION.split('.').map(Number);a(pa[0]*10000+pa[1]*100+pa[2]>=pb[0]*10000+pb[1]*100+pb[2])});

// ── Module exists ────────────────────────────────────────────────────────
t('tools: kosame-chat-history.js exists',()=>{a(fs.existsSync(path.join(ROOT,'tools','kosame-chat-history.js')))});

// ── Module exports ───────────────────────────────────────────────────────
var historyMod = require(path.join(ROOT,'tools','kosame-chat-history'));
t('export: loadChatHistory',()=>{a(typeof historyMod.loadChatHistory==='function')});
t('export: appendChatHistory',()=>{a(typeof historyMod.appendChatHistory==='function')});
t('export: formatHistoryForContext',()=>{a(typeof historyMod.formatHistoryForContext==='function')});
t('export: HISTORY_FILE',()=>{a(historyMod.HISTORY_FILE.includes('.kosame-state')&&historyMod.HISTORY_FILE.includes('chat-history.jsonl'))});
t('export: MAX_LOAD_ENTRIES = 20',()=>{a(historyMod.MAX_LOAD_ENTRIES===20)});

// ── Runtime: append and load ─────────────────────────────────────────────
const testEntry = { role: 'user', content: 'テストメッセージ', timestamp: new Date().toISOString() };
const testFile = historyMod.HISTORY_FILE;
if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
t('append: file created',()=>{historyMod.appendChatHistory(testEntry);a(fs.existsSync(testFile))});
t('append: JSONL format',()=>{var r=fs.readFileSync(testFile,'utf8');a(r.includes('"role":"user"')&&r.includes('"content"')&&r.includes('"timestamp"'))});
// Append assistant reply
historyMod.appendChatHistory({ role: 'assistant', content: 'こさめの返答', timestamp: new Date().toISOString() });
t('load: returns array',()=>{var r=historyMod.loadChatHistory();a(Array.isArray(r))});
t('load: has 2 entries',()=>{var r=historyMod.loadChatHistory();a(r.length===2)});
t('load: first is user',()=>{var r=historyMod.loadChatHistory();a(r[0].role==='user')});
t('load: second is assistant',()=>{var r=historyMod.loadChatHistory();a(r[1].role==='assistant')});
t('load: limit works',()=>{var r=historyMod.loadChatHistory(1);a(r.length===1)});

// ── Format for context ──────────────────────────────────────────────────
t('format: returns non-empty string',()=>{var r=historyMod.loadChatHistory();var s=historyMod.formatHistoryForContext(r);a(typeof s==='string'&&s.length>0)});
t('format: contains 最近の会話履歴',()=>{var r=historyMod.loadChatHistory();var s=historyMod.formatHistoryForContext(r);a(s.includes('最近の会話履歴'))});

// ── Source integration ───────────────────────────────────────────────────
var gptSrc = rd('tools/kosame-chat-gpt.js');
t('gpt: imports kosame-chat-history',()=>{a(gptSrc.includes("require('./kosame-chat-history')"))});
t('gpt: calls loadChatHistory',()=>{a(gptSrc.includes('loadChatHistory()'))});
t('gpt: calls formatHistoryForContext',()=>{a(gptSrc.includes('formatHistoryForContext'))});

var chatSrc = rd('tools/kosame-cockpit-chat-server.js');
t('chat-server: imports kosame-chat-history',()=>{a(chatSrc.includes("require('./kosame-chat-history')"))});
t('chat-server: calls appendChatHistory',()=>{a(chatSrc.includes('appendChatHistory'))});

// ── Package ──────────────────────────────────────────────────────────────
t('pkg: smoke:v113-9-5',()=>{a(PKG.scripts['smoke:v113-9-5'])});
t('pkg: verify includes v113-9-5',()=>{a(PKG.scripts['verify:dev-os']&&PKG.scripts['verify:dev-os'].includes('smoke:v113-9-5'))});

// Cleanup
if (fs.existsSync(testFile)) fs.unlinkSync(testFile);

var total=p+f;console.log('');
if(f===0){console.log('✅ v'+MIN_VERSION+' smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ v'+MIN_VERSION+' smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
