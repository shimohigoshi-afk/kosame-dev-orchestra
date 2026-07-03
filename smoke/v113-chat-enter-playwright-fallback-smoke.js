#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}
console.log('===== Chat Enter fallback smoke =====');
var html=fs.readFileSync(path.join(ROOT,'public/kosame-live-cockpit.html'),'utf8');
t('html: chat-input',()=>{a(html.includes('id="chat-input"'))});
t('html: chat-send exists',()=>{a(html.match(/id="?chat-send"?/))});
t('html: chat-proceed',()=>{a(html.includes('id="chat-proceed"'))});
var s=(html.match(/<script>([\s\S]*)<\/script>/)||['',''])[1];
t('script: submitChatFromInput unified',()=>{a(s.includes('function submitChatFromInput'))});
t('script: _chatSubmitLock',()=>{a(s.includes('_chatSubmitLock'))});
t('script: keyup fallback Enter',()=>{a(s.includes("keyup'")||s.includes('keyup"'))});
t('script: chat-send→submitChatFromInput',()=>{a(s.includes("'chat-send'"))});
t('script: chat-proceed→submitChatFromInput',()=>{a(s.includes("'chat-proceed'"))});
t('script: KOSAME_CHAT_DEBUG',()=>{a(s.includes('KOSAME_CHAT_DEBUG'))});
t('script: composition guard',()=>{a(s.includes('_chatComposing'))});
t('script: paste handler',()=>{a(s.includes("paste'")||s.includes('paste"'))});
t('pkg: smoke:chat-enter-fallback',()=>{a(PKG.scripts['smoke:chat-enter-fallback'])});
['smoke:v113-9-4','smoke:v113-9-3','smoke:v113-9-2','smoke:v113-9-1'].forEach(function(s){t('existing: '+s,()=>{a(PKG.scripts[s])})});
var total=p+f;console.log('');if(f===0)console.log('✅ PASSED ('+p+'/'+total+')');else{console.error('❌ FAILED ('+p+'/'+total+')');process.exit(1)}
