#!/usr/bin/env node
'use strict';

const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),MIN_VERSION='113.9.1';
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}

console.log('===== v'+MIN_VERSION+' Console UI target inference smoke =====');
t('version >= '+MIN_VERSION,()=>{const pa=PKG.version.split('.').map(Number),pb=MIN_VERSION.split('.').map(Number);a(pa[0]*10000+pa[1]*100+pa[2]>=pb[0]*10000+pb[1]*100+pb[2])});

// ── Chat server: REPO_MAIN_FILES_CONTEXT ───────────────────────────────────
var chat=rd('tools/kosame-cockpit-chat-server.js');
t('REPO: 逆質問しないこと',()=>{a(chat.includes('逆質問しないこと'))});
t('REPO: public/kosame-live-cockpit.html mapped',()=>{a(chat.includes('public/kosame-live-cockpit.html'))});
t('REPO: UI改善指示 rule',()=>{a(chat.includes('UI改善指示'))});

// ── Keyword injection trigger expanded ─────────────────────────────────────
t('trigger: AGENT STREAM',()=>{a(/AGENT STREAM|コンソール|ASL|RUNNER|PROGRESS|通知音|クリップ|Project Strip|Roadmap|Field Ops|Limit Break|Recovery|History|Next Action/.test(
  chat.slice(chat.indexOf('// Inject repo main files'))
))});

// ── resolveWorkOrderTarget auto-detects UI keywords ────────────────────────
t('target: auto-detect Console UI keywords',()=>{
  var fn=chat.slice(chat.indexOf('function resolveWorkOrderTarget'));
  a(fn.includes('AGENT STREAM')||fn.includes('KOSAME Console'), 'missing UI keyword auto-detect');
  a(fn.includes('WORK_ORDER_TARGETS[1]'), 'missing WORK_ORDER_TARGETS[1] return');
});

// ── Sample UI keyword inference ────────────────────────────────────────────
['AGENT STREAM LOG','ASL','RUNNER','PROGRESS','通知音','クリップ',
 'Project Strip','Roadmap','Field Ops','Limit Break','Recovery','History','Next Action',
 'chat-proceed','chat-sound','cockpit'].forEach(function(kw){
  t('UI keyword: '+kw.slice(0,25),()=>{a(new RegExp(kw,'i').test(chat))});
});

// ── ASL color CSS exists ───────────────────────────────────────────────────
var html=rd('public/kosame-live-cockpit.html');
t('CSS: asl-start',()=>{a(html.includes('asl-start'))});
t('CSS: asl-running',()=>{a(html.includes('asl-running'))});
t('CSS: asl-done-ok',()=>{a(html.includes('asl-done-ok'))});
t('CSS: asl-done-fail',()=>{a(html.includes('asl-done-fail'))});
t('CSS: asl-route',()=>{a(html.includes('asl-route'))});
t('CSS: asl-dispatch',()=>{a(html.includes('asl-dispatch'))});

// ── ASL JS color logic exists ──────────────────────────────────────────────
t('JS: asl-start class added',()=>{a(html.includes("'asl-start'"))});
t('JS: asl-running class added',()=>{a(html.includes("'asl-running'"))});
t('JS: addAgentStreamLog preserved',()=>{a(html.includes('function addAgentStreamLog'))});

// ── Existing ASL agents preserved ──────────────────────────────────────────
['ASL_AGENTS','KOSAME','DIRECTOR','Claude','Gemini','DeepSeek','Llama'].forEach(function(agent){
  t('agent preserved: '+agent,()=>{a(html.includes(agent))});
});

// ── chat-proceed preserved ─────────────────────────────────────────────────
t('chat-proceed preserved',()=>{a(html.includes('chat-proceed'))});
t('chat-sound-badge preserved',()=>{a(html.includes('chat-sound-badge'))});
t('agent-stream-log preserved',()=>{a(html.includes('agent-stream-log'))});

// ── Smoke scripts ──────────────────────────────────────────────────────────
t('pkg: smoke:v113-9-1',()=>{a(PKG.scripts['smoke:v113-9-1'])});
t('verify includes v113-9-1',()=>{a(PKG.scripts['verify:dev-os'].includes('smoke:v113-9-1'))});

var total=p+f;console.log('');
if(f===0){console.log('✅ v'+MIN_VERSION+' smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ v'+MIN_VERSION+' smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
