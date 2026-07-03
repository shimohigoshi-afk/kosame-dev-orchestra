#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}
console.log('===== Chat Enter Playwright fallback smoke =====');
t('playwright-test exists',()=>{a(fs.existsSync(path.join(ROOT,'tools/kosame-chat-enter-playwright-test.js')))});
var html=fs.readFileSync(path.join(ROOT,'public/kosame-live-cockpit.html'),'utf8');
t('html: chat-input',()=>{a(html.includes('id="chat-input"'))});
t('html: chat-proceed',()=>{a(html.includes('id="chat-proceed"'))});
var s=(html.match(/<script>([\s\S]*)<\/script>/)||['',''])[1];
t('script: submitPrioritizedChatInput',()=>{a(s.includes('function submitPrioritizedChatInput'))});
t('script: _zeroConfirmDispatch',()=>{a(s.includes('function _zeroConfirmDispatch'))});
t('script: Enter keydown handler',()=>{a(s.includes("key === 'Enter'")&&s.includes('!e.shiftKey'))});
t('script: composition guard',()=>{a(s.includes('_chatComposing'))});
t('script: paste handler',()=>{a(s.includes("paste'")||s.includes('paste"'))});
t('script: /api/runner-dispatch',()=>{a(s.includes('/api/runner-dispatch'))});
t('script: ASL queue exists',()=>{a(s.includes('_aslQueue'))});
t('pkg: ops:chat-enter-playwright-test',()=>{a(PKG.scripts['ops:chat-enter-playwright-test'])});
t('pkg: smoke:chat-enter-fallback',()=>{a(PKG.scripts['smoke:chat-enter-fallback'])});
['smoke:v113-9-4','smoke:v113-9-3','smoke:v113-9-2','smoke:v113-9-1'].forEach(function(s){t('existing: '+s,()=>{a(PKG.scripts[s])})});
var total=p+f;console.log('');if(f===0)console.log('✅ PASSED ('+p+'/'+total+')');else{console.error('❌ FAILED ('+p+'/'+total+')');process.exit(1)}
