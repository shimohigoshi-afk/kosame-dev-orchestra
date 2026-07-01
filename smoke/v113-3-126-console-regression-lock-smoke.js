#!/usr/bin/env node
'use strict';

const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),MIN_VERSION='113.3.126';
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}

console.log('===== v'+MIN_VERSION+' console regression lock smoke =====');
t('version >= '+MIN_VERSION,()=>{const pa=PKG.version.split('.').map(Number),pb=MIN_VERSION.split('.').map(Number);a(pa[0]*10000+pa[1]*100+pa[2]>=pb[0]*10000+pb[1]*100+pb[2])});

// Server source: all expected handlers present
var src=rd('tools/kosame-live-cockpit-server.js');
t('server: healthz',()=>{a(src.includes('healthz'))});
t('server: /api/snapshot',()=>{a(src.includes('/api/snapshot'))});
t('server: /api/runner-stream',()=>{a(src.includes('/api/runner-stream'))});
t('server: text/event-stream',()=>{a(src.includes('text/event-stream'))});
t('server: /api/work-orders/result',()=>{a(src.includes('/api/work-orders/result'))});
t('server: /api/executor/latest',()=>{a(src.includes('/api/executor/latest'))});
t('server: /api/executor/history',()=>{a(src.includes('/api/executor/history'))});
t('server: /api/executor/readiness',()=>{a(src.includes('/api/executor/readiness'))});
t('server: /api/executor/release-gate',()=>{a(src.includes('/api/executor/release-gate'))});
t('server: /api/executor/roadmap',()=>{a(src.includes('/api/executor/roadmap'))});

// HTML: all required DOM elements
var html=rd('public/kosame-live-cockpit.html');
t('html: KOSAME Console',()=>{a(html.includes('KOSAME Console'))});
t('html: chat-input',()=>{a(html.includes('chat-input'))});
t('html: chat-proceed',()=>{a(html.includes('chat-proceed'))});
t('html: chat-sound-badge',()=>{a(html.includes('chat-sound-badge'))});
t('html: chat-attach-btn',()=>{a(html.includes('chat-attach-btn'))});
t('html: agent-stream-log',()=>{a(html.includes('agent-stream-log'))});
t('html: deepseek-handoff-strip',()=>{a(html.includes('deepseek-handoff-strip'))});
t('html: deepseek-result-strip',()=>{a(html.includes('deepseek-result-strip'))});
t('html: deepseek-action-strip',()=>{a(html.includes('deepseek-action-strip'))});
t('html: rc100-gate-content',()=>{a(html.includes('rc100-gate-content'))});
t('html: field-ops-panel',()=>{a(html.includes('field-ops-panel'))});
t('html: limit-break-status',()=>{a(html.includes('limit-break-status'))});
t('html: roadmap-status',()=>{a(html.includes('roadmap-status'))});
t('html: AGENT STREAM LOG',()=>{a(html.includes('AGENT STREAM LOG'))});
t('html: renderDeepSeekHandoff',()=>{a(html.includes('function renderDeepSeekHandoff'))});
t('html: renderDeepSeekResult',()=>{a(html.includes('function renderDeepSeekResult'))});
t('html: renderLimitBreakPanel',()=>{a(html.includes('function renderLimitBreakPanel'))});
t('html: renderRC100Dashboard',()=>{a(html.includes('function renderRC100Dashboard'))});
t('html: renderRoadmapPanel',()=>{a(html.includes('function renderRoadmapPanel'))});

// Snapshot response validation via source
t('snapshot: projects or mode',()=>{a(src.includes('project')||src.includes('mode')||src.includes('Readonly'))});

var total=p+f;console.log('');
if(f===0){console.log('✅ v'+MIN_VERSION+' smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ v'+MIN_VERSION+' smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
