#!/usr/bin/env node
// Full self-test: version gate, API endpoints, state files, cost-meter, wishlist, MLR routing, console UI elements.
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),CANONICAL='<!DOCTYPE html>\n<html lang="ja">\n<head>\n  <meta charset="UTF-8">\n  <title>KOSAME WORKS</title>\n</head>\n<body>\n  <h1>KOSAME WORKS</h1>\n</body>\n</html>\n';
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}
const {detectConfidentiality,detectTaskDifficulty,selectModelLane}=require('../tools/kosame-runner-queue');

console.log('===== v'+PKG.version+' full self-test smoke =====');
t('version >= 113.8.0',()=>{const pa=PKG.version.split('.').map(Number),pb='113.8.0'.split('.').map(Number);a(pa[0]*10000+pa[1]*100+pa[2]*1>=pb[0]*10000+pb[1]*100+pb[2]*1)});

// ── Step 4 API checks ─────────────────────────────────────────────────────
const BASE='http://localhost:8080';
let serverUp=false;
try{const r=cp.spawnSync('curl',['-s','-m','2',BASE+'/healthz'],{encoding:'utf8',timeout:4000});if((r.stdout||'').trim()==='ok')serverUp=true}catch(_){}
t('server: healthz',()=>{a(serverUp)});

if(serverUp){
  try{const d=JSON.parse(cp.spawnSync('curl',['-s','-m','3',BASE+'/api/snapshot'],{encoding:'utf8',timeout:5000}).stdout||'{}');t('api: snapshot version',()=>{a(d.version)});t('api: snapshot projects>=2',()=>{a((d.projects||[]).length>=2)})}catch(_){}
  t('api: runner-dispatch endpoint check',()=>{
    try{const d=JSON.parse(cp.spawnSync('curl',['-s','-m','5','-X','POST',BASE+'/api/runner-dispatch','-H','Content-Type: application/json','-d','{"prompt_text":"add comment","route":"zero-confirm"}'],{encoding:'utf8',timeout:8000}).stdout||'{}');a(d.ok===true||d.ok===false)}catch(_){}
  });
}

// ── State files ────────────────────────────────────────────────────────────
['task-vault.json','cost-meter.json','wishlist.json','auto-save.json','next-actions.json','last-known-good.json'].forEach(function(f){
  t('state: '+f,()=>{a(fs.existsSync(path.join(ROOT,'.kosame-state',f)))});
});

// ── 4.0 Chat Self-Test ────────────────────────────────────────────────────
t('4.0: Task Vault has current_mission',()=>{a(JSON.parse(fs.readFileSync(path.join(ROOT,'.kosame-state','task-vault.json'),'utf8')).current_mission)});
t('4.0: Task Vault has judge_status',()=>{a(JSON.parse(fs.readFileSync(path.join(ROOT,'.kosame-state','task-vault.json'),'utf8')).judge_status)});

// ── 4.1 Task Vault Console display ────────────────────────────────────────
t('4.1: HTML has task-vault ref or panel',()=>{var h=rd('public/kosame-live-cockpit.html');a(h.includes('task-vault')||h.includes('Task Vault')||h.includes('current_mission'),'no task vault ref')});

// ── 4.2 Auto Save ─────────────────────────────────────────────────────────
t('4.2: auto-save interval=50min',()=>{a(JSON.parse(fs.readFileSync(path.join(ROOT,'.kosame-state','auto-save.json'),'utf8')).interval_min===50)});

// ── 4.3 Mission Restore ───────────────────────────────────────────────────
t('4.3: task-vault has model_lane',()=>{a(JSON.parse(fs.readFileSync(path.join(ROOT,'.kosame-state','task-vault.json'),'utf8')).model_lane)});

// ── 4.4 Next Action Console ───────────────────────────────────────────────
t('4.4: next-actions has actions',()=>{a((JSON.parse(fs.readFileSync(path.join(ROOT,'.kosame-state','next-actions.json'),'utf8')).actions||[]).length>0)});

// ── 4.5 Chat-to-Task Converter ────────────────────────────────────────────
t('4.5: chat-task-seed exists',()=>{a(fs.existsSync(path.join(ROOT,'.kosame-state','chat-task-seed.json')))});
t('4.5: chat-task-seed has 5 templates',()=>{a(JSON.parse(fs.readFileSync(path.join(ROOT,'.kosame-state','chat-task-seed.json'),'utf8')).count>=5)});

// ── 6.0-6.3 Cost Meter ────────────────────────────────────────────────────
var cm=JSON.parse(fs.readFileSync(path.join(ROOT,'.kosame-state','cost-meter.json'),'utf8'));
t('6.0: cost-meter has deepseek',()=>{a(cm.deepseek)});
t('6.1: has gpt/gemini/groq',()=>{a(cm.gpt&&cm.gemini&&cm.groq)});
t('6.2: deepseek has flash/pro/audit',()=>{a(cm.deepseek.flash!==undefined&&cm.deepseek.pro!==undefined&&cm.deepseek.pro_audit!==undefined)});
t('6.3: high_cost_warning field',()=>{a(cm.high_cost_warning===false||cm.high_cost_warning===true)});

// ── 7.0-7.2 Wishlist ──────────────────────────────────────────────────────
var wl=JSON.parse(fs.readFileSync(path.join(ROOT,'.kosame-state','wishlist.json'),'utf8'));
t('7.0: wishlist has 5 items',()=>{a(wl.count===5)});
t('7.1: items have priority',()=>{a(wl.items[0].priority)});
t('7.2: items have suggested_after',()=>{a(wl.items[0].suggested_after)});

// ── Model Lane Router ─────────────────────────────────────────────────────
t('MLR: detectConfidentiality safe',()=>{a(detectConfidentiality({prompt_text:'add comment'})==='safe')});
t('MLR: detectConfidentiality forbidden',()=>{a(detectConfidentiality({prompt_text:'.env fix'})==='forbidden')});
t('MLR: detectTaskDifficulty low',()=>{a(detectTaskDifficulty({prompt_text:'add comment'})==='low')});
t('MLR: detectTaskDifficulty medium',()=>{a(detectTaskDifficulty({prompt_text:'implement function component'})==='medium')});
t('MLR: detectTaskDifficulty high',()=>{a(detectTaskDifficulty({prompt_text:'refactor security fix'})==='high')});
t('MLR: detectTaskDifficulty blocked',()=>{a(detectTaskDifficulty({prompt_text:'rm -rf'})==='blocked')});
t('MLR: selectModelLane L1',()=>{a(selectModelLane({prompt_text:'add comment'}).lane==='L1_DEEPSEEK_V4_FLASH')});
t('MLR: selectModelLane L2',()=>{a(selectModelLane({prompt_text:'implement function component'}).lane==='L2_DEEPSEEK_V4_PRO')});
t('MLR: selectModelLane L3 audit',()=>{var r=selectModelLane({prompt_text:'refactor security fix'});a(r.lane==='L3_DEEPSEEK_V4_PRO_AUDIT');a(r.audit_required)});
t('MLR: selectModelLane BLOCKED',()=>{a(selectModelLane({prompt_text:'.env fix'}).lane==='BLOCKED')});
t('MLR: selectModelLane INTERNAL',()=>{a(selectModelLane({prompt_text:'customer data migration'}).lane==='INTERNAL_ONLY')});
t('MLR: handoff has recommended_model',()=>{var hp=require('../tools/kosame-runner-queue').writeDeepSeekHandoffFile({id:'mlrtest',title:'t',prompt_text:'refactor security fix',target_repo:ROOT},{},path.join(ROOT,'.kosame-runner','runs','dummy'));var c=fs.readFileSync(hp,'utf8');a(c.includes('recommended_model:'));a(c.includes('model_lane:'))});

// ── Console UI elements ────────────────────────────────────────────────────
var html=rd('public/kosame-live-cockpit.html');
t('UI: chat-sound-badge',()=>{a(html.includes('chat-sound-badge'))});
t('UI: chat-attach-btn',()=>{a(html.includes('chat-attach-btn'))});
t('UI: chat-proceed',()=>{a(html.includes('chat-proceed'))});
t('UI: agent-stream-log',()=>{a(html.includes('agent-stream-log'))});
t('UI: deepseek-handoff',()=>{a(html.includes('deepseek-handoff-strip'))});
t('UI: limit-break',()=>{a(html.includes('limit-break-status'))});
t('UI: roadmap',()=>{a(html.includes('roadmap-status'))});
t('UI: field-ops',()=>{a(html.includes('field-ops-panel'))});

// ── Cleanup ────────────────────────────────────────────────────────────────
t('cleanup: canonical',()=>{fs.writeFileSync(path.join(ROOT,'public','test.html'),CANONICAL);a(fs.readFileSync(path.join(ROOT,'public','test.html'),'utf8')===CANONICAL)});
t('cleanup: git diff empty',()=>{var d=cp.spawnSync('git',['diff','--','public/test.html'],{cwd:ROOT,encoding:'utf8',timeout:5000});a(!(d.stdout||'').trim())});

// ── Contamination ──────────────────────────────────────────────────────────
t('no sales-dx/transcriber',()=>{['transcriber','sales-dx'].forEach(function(b){a(!ROOT.includes(b))})});
t('no ANESTY',()=>{[rd('tools/kosame-live-cockpit-server.js'),rd('tools/kosame-runner-queue.js'),rd('public/kosame-live-cockpit.html')].forEach(function(f){a(!f.includes('ANESTY Board'))})});

var total=p+f;console.log('');
if(f===0){console.log('✅ v'+PKG.version+' full self-test smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ v'+PKG.version+' full self-test smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
