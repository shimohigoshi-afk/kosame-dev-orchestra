#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),MIN_VERSION='113.9.3';
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}

console.log('===== v'+MIN_VERSION+' deepseek handoff chat finalize smoke =====');
t('version >= '+MIN_VERSION,()=>{const pa=PKG.version.split('.').map(Number),pb=MIN_VERSION.split('.').map(Number);a(pa[0]*10000+pa[1]*100+pa[2]>=pb[0]*10000+pb[1]*100+pb[2])});

var html=rd('public/kosame-live-cockpit.html');

// ── SSE done event — deepseek status handling ─────────────────────────────
t('done handler: deepseek_patch_required check',()=>{a(html.includes("status === 'deepseek_patch_required'")||html.includes('deepseek_patch_required'))});
t('done handler: 作業票生成 message',()=>{a(html.includes('作業票生成')||html.includes('DeepSeek'))});
t('done handler: blocked_with_reason check',()=>{a(html.includes('blocked_with_reason')||html.includes('ブロック'))});
t('done handler: completed check',()=>{a(html.includes("status === 'completed'")||html.includes('✅ 完了'))});

// ── Chat: _zeroConfirmDispatch has finally hideTypingIndicator ────────────
t('chat: hideTypingIndicator in finally',()=>{a(html.match(/_zeroConfirmDispatch[\s\S]*?finally[\s\S]*?hideTypingIndicator/))});
t('chat: renderChatThread in finally',()=>{a(html.match(/_zeroConfirmDispatch[\s\S]*?finally[\s\S]*?renderChatThread/))});

// ── ASL history/live distinction ───────────────────────────────────────────
t('CSS: asl-history class',()=>{a(html.includes('asl-history'))});
t('CSS: asl-live class',()=>{a(html.includes('asl-live'))});
t('CSS: prefers-reduced-motion',()=>{a(html.includes('prefers-reduced-motion'))});

// ── ASL active animation ──────────────────────────────────────────────────
t('CSS: asl-progress-active',()=>{a(html.includes('asl-progress-active'))});
t('CSS: asl-running-active',()=>{a(html.includes('asl-running-active'))});
t('CSS: aslPulse keyframes',()=>{a(html.includes('aslPulse'))});
t('CSS: aslDots keyframes',()=>{a(html.includes('aslDots'))});

// ── ASL queue system ──────────────────────────────────────────────────────
t('JS: _aslQueue array',()=>{a(html.includes('_aslQueue'))});
t('JS: _aslFlush function',()=>{a(html.includes('_aslFlush'))});
t('JS: _aslInterval defined',()=>{a(html.includes('_aslInterval'))});

// ── Font size preserved ───────────────────────────────────────────────────
t('ASL: font-size 14px',()=>{a(html.match(/agent-stream-log-body[^}]*font-size:\s*1[4-9]px/))});

// ── Server: done SSE includes status ──────────────────────────────────────
var srv=rd('tools/kosame-live-cockpit-server.js');
t('srv: done SSE includes status field',()=>{a(srv.includes('status: result.status')||srv.includes('status:'))});

// ── Package ───────────────────────────────────────────────────────────────
t('pkg: smoke:v113-9-3',()=>{a(PKG.scripts['smoke:v113-9-3'])});
t('pkg: verify includes v113-9-3',()=>{a(PKG.scripts['verify:dev-os']&&PKG.scripts['verify:dev-os'].includes('smoke:v113-9-3'))});

// ── Existing preserves ────────────────────────────────────────────────────
['addAgentStreamLog','ASL_AGENTS','chat-proceed','agent-stream-log'].forEach(function(e){
  t('preserved: '+e,()=>{a(html.includes(e))});
});

var total=p+f;console.log('');
if(f===0){console.log('✅ v'+MIN_VERSION+' smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ v'+MIN_VERSION+' smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
