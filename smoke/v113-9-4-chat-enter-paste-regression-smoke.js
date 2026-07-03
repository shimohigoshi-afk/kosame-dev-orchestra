#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),MIN_VERSION='113.9.4';
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}

console.log('===== v'+MIN_VERSION+' chat enter paste regression smoke =====');
t('version >= '+MIN_VERSION,()=>{const pa=PKG.version.split('.').map(Number),pb=MIN_VERSION.split('.').map(Number);a(pa[0]*10000+pa[1]*100+pa[2]>=pb[0]*10000+pb[1]*100+pb[2])});

var html=rd('public/kosame-live-cockpit.html');

// ── chat-input exists ─────────────────────────────────────────────────────
t('dom: chat-input',()=>{a(html.includes('id="chat-input"'))});

// ── Enter keydown handler ─────────────────────────────────────────────────
t('JS: keydown handler',()=>{a(html.includes("key === 'Enter'")&&html.includes('!e.shiftKey'))});

// ── IME composition guard ─────────────────────────────────────────────────
t('JS: compositionstart guard',()=>{a(html.includes('compositionstart'))});
t('JS: compositionend guard',()=>{a(html.includes('compositionend'))});
t('JS: _chatComposing flag',()=>{a(html.includes('_chatComposing'))});
t('JS: !_chatComposing in Enter check',()=>{a(html.includes('!_chatComposing'))});

// ── Paste handler ─────────────────────────────────────────────────────────
t('JS: paste handler',()=>{a(html.includes("paste'")||html.includes('paste"'))});
t('JS: paste handler focuses textarea',()=>{a(html.includes('.focus()'))});

// ── Enter handler calls submitPrioritizedChatInput ─────────────────────────
t('JS: submitPrioritizedChatInput called',()=>{a(html.includes('submitPrioritizedChatInput'))});

// ── chat-proceed preserved ────────────────────────────────────────────────
t('dom: chat-proceed',()=>{a(html.includes('chat-proceed'))});

// ── ASL queue preserved ───────────────────────────────────────────────────
t('JS: _aslQueue preserved',()=>{a(html.includes('_aslQueue'))});
t('JS: addAgentStreamLog preserved',()=>{a(html.includes('function addAgentStreamLog'))});

// ── DeepSeek handoff fix preserved ────────────────────────────────────────
t('JS: done handler deepseek check preserved',()=>{a(html.includes('deepseek_patch_required'))});

// ── Package ───────────────────────────────────────────────────────────────
t('pkg: smoke:v113-9-4',()=>{a(PKG.scripts['smoke:v113-9-4'])});
t('pkg: verify includes v113-9-4',()=>{a(PKG.scripts['verify:dev-os']&&PKG.scripts['verify:dev-os'].includes('smoke:v113-9-4'))});

var total=p+f;console.log('');
if(f===0){console.log('✅ v'+MIN_VERSION+' smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ v'+MIN_VERSION+' smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
