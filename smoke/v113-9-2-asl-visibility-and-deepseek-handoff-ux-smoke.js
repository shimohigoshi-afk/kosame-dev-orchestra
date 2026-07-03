#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),MIN_VERSION='113.9.2';
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}

console.log('===== v'+MIN_VERSION+' ASL visibility + DeepSeek handoff UX smoke =====');
t('version >= '+MIN_VERSION,()=>{const pa=PKG.version.split('.').map(Number),pb=MIN_VERSION.split('.').map(Number);a(pa[0]*10000+pa[1]*100+pa[2]>=pb[0]*10000+pb[1]*100+pb[2])});

var html=rd('public/kosame-live-cockpit.html');

// ── ASL font size & readability ───────────────────────────────────────────
t('ASL: font-size >= 14px',()=>{a(html.match(/agent-stream-log-body[^}]*font-size:\s*1[4-9]px/)||html.match(/\.agent-stream-log-body[^}]*font-size:\s*1[4-9]px/))});
t('ASL: line-height near 1.6',()=>{a(html.includes('line-height: 1.6')||html.includes('line-height: 1.55')||html.includes('line-height: 1.65'))});
t('ASL: entry padding >= 2px',()=>{a(html.includes('padding: 2px 0')||html.includes('padding: 2px'))});

// ── Color classes ─────────────────────────────────────────────────────────
t('CSS: asl-start class exists',()=>{a(html.includes('.asl-start')||html.includes('asl-start'))});
t('CSS: asl-running class exists',()=>{a(html.includes('.asl-running')||html.includes('asl-running'))});
t('CSS: asl-done-ok class exists',()=>{a(html.includes('.asl-done-ok')||html.includes('asl-done-ok'))});
t('CSS: asl-done-fail class exists',()=>{a(html.includes('.asl-done-fail')||html.includes('asl-done-fail'))});
t('CSS: asl-route class exists',()=>{a(html.includes('.asl-route')||html.includes('asl-route'))});
t('CSS: asl-dispatch class exists',()=>{a(html.includes('.asl-dispatch')||html.includes('asl-dispatch'))});
t('CSS: asl-progress class exists',()=>{a(html.includes('.asl-progress')||html.includes('asl-progress'))});

// ── JS color logic ────────────────────────────────────────────────────────
t('JS: addAgentStreamLog exists',()=>{a(html.includes('function addAgentStreamLog'))});
t('JS: asl-progress class applied',()=>{a(html.includes("'asl-progress'"))});
t('JS: asl-start class applied',()=>{a(html.includes("'asl-start'"))});
t('JS: asl-running class applied',()=>{a(html.includes("'asl-running'"))});
t('JS: asl-done-ok class applied',()=>{a(html.includes("'asl-done-ok'"))});
t('JS: asl-done-fail class applied',()=>{a(html.includes("'asl-done-fail'"))});

// ── DeepSeek handoff UX (zero-confirm dispatch) ───────────────────────────
t('DS: _zeroConfirmDispatch exists',()=>{a(html.includes('function _zeroConfirmDispatch'))});
t('DS: hideTypingIndicator in finally',()=>{a(html.match(/_zeroConfirmDispatch[\s\S]*?finally[\s\S]*?hideTypingIndicator/))});
t('DS: [START] Runner実行開始 reply',()=>{a(html.includes('[START] Runner実行開始'))});
t('DS: chatHistory push on dispatch ok',()=>{a(html.includes("chatHistory.push({ role: 'assistant'")&&html.includes('Runner実行開始'))});

// ── Existing ASL agents preserved ─────────────────────────────────────────
['KOSAME','DIRECTOR','Claude','Gemini','DeepSeek','Llama','ASL_AGENTS','ASL_DISPLAY_NAMES'].forEach(function(agent){
  t('preserved: '+agent,()=>{a(html.includes(agent))});
});

// ── Verify chat-proceed / chat-sound preserved ───────────────────────────
t('preserved: chat-proceed',()=>{a(html.includes('chat-proceed'))});
t('preserved: chat-sound-badge',()=>{a(html.includes('chat-sound-badge'))});
t('preserved: agent-stream-log',()=>{a(html.includes('agent-stream-log'))});

// ── Chat server: no "which file" for UI keywords ──────────────────────────
var chat=rd('tools/kosame-cockpit-chat-server.js');
t('chat: auto-detect KOSAME Console for UI terms',()=>{a(chat.includes('AGENT STREAM')&&chat.includes('KOSAME Console'))});
t('chat: resolveWorkOrderTarget has UI fallback',()=>{a(chat.includes('AGENT STREAM')||chat.includes('KOSAME Console'))});

// ── Package ───────────────────────────────────────────────────────────────
t('pkg: smoke:v113-9-2',()=>{a(PKG.scripts['smoke:v113-9-2'])});
t('pkg: verify includes v113-9-2',()=>{a(PKG.scripts['verify:dev-os']&&PKG.scripts['verify:dev-os'].includes('smoke:v113-9-2'))});

var total=p+f;console.log('');
if(f===0){console.log('✅ v'+MIN_VERSION+' smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ v'+MIN_VERSION+' smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
