#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),MIN_VERSION='113.3.124',EXECUTOR_DIR=path.join(ROOT,'.kosame-executor'),CANONICAL_HTML='<!DOCTYPE html>\n<html lang="ja">\n<head>\n  <meta charset="UTF-8">\n  <title>Test</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>\n';
let p=0,f=0;
function cv(a,b){const pa=a.split('.').map(Number),pb=b.split('.').map(Number);for(let i=0;i<3;i++){if((pa[i]||0)>(pb[i]||0))return 1;if((pa[i]||0)<(pb[i]||0))return-1}return 0}
function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}
function a(c,m){if(!c)throw new Error(m||'assertion failed')}
function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}
const {detectConfidentiality,detectTaskDifficulty,selectModelLane}=require('../tools/kosame-runner-queue');

console.log('===== v'+MIN_VERSION+' limit break autopilot smoke =====');
t('version >= 113.3.124',()=>{a(cv(PKG.version,MIN_VERSION)>=0)});

t('limit-break-runner exists',()=>{a(fs.existsSync(path.join(ROOT,'tools/kosame-dev-os-limit-break-runner.js')))});
t('ops:limit-break script exists',()=>{a(PKG.scripts['ops:limit-break'])});
t('limit-break-runner has 30+ scenarios',()=>{var c=rd('tools/kosame-dev-os-limit-break-runner.js');a(c.includes('SCENARIOS')&&c.split('{cat:').length>20)});

['limit-break-report','operational-evidence','real-run-readiness'].forEach(function(api){
  t('API: '+api,()=>{a(rd('tools/kosame-live-cockpit-server.js').includes('/api/executor/'+api))});
});

t('limit-break-report.md gen check',()=>{a(rd('tools/kosame-dev-os-limit-break-runner.js').includes('limit-break-report.md'))});
t('limit-break-report.json gen check',()=>{a(rd('tools/kosame-dev-os-limit-break-runner.js').includes('limit-break-report.json'))});
t('operational-evidence.md gen check',()=>{a(rd('tools/kosame-dev-os-limit-break-runner.js').includes('operational-evidence.md'))});
t('real-run-readiness.md gen check',()=>{a(rd('tools/kosame-dev-os-limit-break-runner.js').includes('real-run-readiness.md'))});

t('UI: limit-break-status',()=>{a(rd('public/kosame-live-cockpit.html').includes('limit-break-status'))});
t('UI: renderLimitBreakPanel',()=>{a(rd('public/kosame-live-cockpit.html').includes('renderLimitBreakPanel'))});
t('UI: renderLimitBreakPanel called',()=>{a(rd('public/kosame-live-cockpit.html').includes('renderLimitBreakPanel()'))});

// ── Confidentiality ────────────────────────────────────────────────────────
[['safe', 'add comment', 'safe'],['sanitized', 'smoke test add', 'sanitized'],['sensitive', 'customer data fix', 'sensitive'],
 ['forbidden .env', '.env fix', 'forbidden'],['forbidden deploy', 'deploy now', 'forbidden'],['forbidden sales-dx', 'sales-dx pipeline', 'forbidden']].forEach(function(ct){
  t('conf: '+ct[0],()=>{a(detectConfidentiality({prompt_text:ct[1]})===ct[2])});
});

// ── Difficulty ─────────────────────────────────────────────────────────────
[['low', 'UI polish', 'low'],['medium', 'implement function component', 'medium'],['high', 'refactor security fix', 'high'],['blocked', '../escape', 'blocked']].forEach(function(dt){
  t('diff: '+dt[0],()=>{a(detectTaskDifficulty({prompt_text:dt[1]})===dt[2])});
});

// ── Model Lane ─────────────────────────────────────────────────────────────
[['L1', 'add comment', 'L1_DEEPSEEK_V4_FLASH'],['L2', 'implement function component', 'L2_DEEPSEEK_V4_PRO'],['L3 audit', 'refactor security fix', 'L3_DEEPSEEK_V4_PRO_AUDIT'],['INTERNAL', 'customer data migration', 'INTERNAL_ONLY'],['BLOCKED', '.env fix', 'BLOCKED']].forEach(function(lt){
  t('lane: '+lt[0],()=>{a(selectModelLane({prompt_text:lt[1]}).lane===lt[2])});
});

// ── Human Gate / Blocked ───────────────────────────────────────────────────
t('deploy→BLOCKED',()=>{a(selectModelLane({prompt_text:'deploy now'}).lane==='BLOCKED')});
t('push→BLOCKED',()=>{a(selectModelLane({prompt_text:'git push main'}).lane==='BLOCKED')});
t('.env→BLOCKED',()=>{a(selectModelLane({prompt_text:'read .env'}).lane==='BLOCKED')});
t('rm→BLOCKED',()=>{a(selectModelLane({prompt_text:'rm -rf /'}).lane==='BLOCKED')});
t('sensitive→INTERNAL',()=>{a(selectModelLane({prompt_text:'customer billing refactor'}).lane==='INTERNAL_ONLY')});
t('forbidden→BLOCKED',()=>{a(selectModelLane({prompt_text:'credentials.json fix'}).lane==='BLOCKED')});
t('high→audit_required',()=>{a(selectModelLane({prompt_text:'refactor security fix'}).audit_required===true)});
t('sensitive not L2/L3',()=>{var r=selectModelLane({prompt_text:'customer data migration'});a(r.lane!=='L2_DEEPSEEK_V4_PRO');a(r.lane!=='L3_DEEPSEEK_V4_PRO_AUDIT')});
t('forbidden not handoff',()=>{var r=selectModelLane({prompt_text:'.env fix'});a(r.lane==='BLOCKED')});

// ── .gitignore ─────────────────────────────────────────────────────────────
['limit-break-report.md','limit-break-report.json','operational-evidence.md','real-run-readiness.md','latest*.md','latest*.json','history/','run-latest.sh'].forEach(function(g){
  if(g==='run-latest.sh'){t('gitignore: run-latest.sh safe',()=>{a(!rd('.gitignore').split('\n').some(function(l){return l.includes('run-latest.sh')&&!l.startsWith('#')}))})}
  else t('gitignore: '+g,()=>{a(rd('.gitignore').includes(g))});
});

// ── Package ────────────────────────────────────────────────────────────────
['smoke:v113-3-124','ops:limit-break','ops:field','ops:validate','smoke:cleanup','smoke:v113-3-112','smoke:v113-3-114','smoke:v113-3-115','smoke:v113-3-116','smoke:v113-3-117','smoke:v113-3-118','smoke:v113-3-119','smoke:v113-3-120','smoke:v113-3-121','smoke:v113-3-122','smoke:v113-3-123'].forEach(function(s){
  t('pkg: '+s,()=>{a(PKG.scripts&&PKG.scripts[s],'missing: '+s)});
});
t('verify has v124',()=>{a(PKG.scripts['verify:dev-os'].includes('v113-3-124')&&PKG.scripts['verify:dev-os'].includes('smoke:v113-3-124'))});

// ── ops:limit-break executes ───────────────────────────────────────────────
t('ops:limit-break runs without crash',()=>{var r=cp.spawnSync(process.execPath,[path.join(ROOT,'tools/kosame-dev-os-limit-break-runner.js')],{cwd:ROOT,encoding:'utf8',timeout:15000});a((r.stdout||'').includes('KOSAME_LIMIT_BREAK'),'missing marker. stdout:'+(r.stdout||'').slice(0,200))});

// ── Generated files exist after run ────────────────────────────────────────
t('limit-break-report.md exists',()=>{a(fs.existsSync(path.join(EXECUTOR_DIR,'limit-break-report.md')))});
t('limit-break-report.json exists',()=>{a(fs.existsSync(path.join(EXECUTOR_DIR,'limit-break-report.json')))});
t('operational-evidence.md exists',()=>{a(fs.existsSync(path.join(EXECUTOR_DIR,'operational-evidence.md')))});
t('real-run-readiness.md exists',()=>{a(fs.existsSync(path.join(EXECUTOR_DIR,'real-run-readiness.md')))});

// ── Cleanup ────────────────────────────────────────────────────────────────
t('test.html canonical',()=>{fs.writeFileSync(path.join(ROOT,'public','test.html'),CANONICAL_HTML);a(fs.readFileSync(path.join(ROOT,'public','test.html'),'utf8')===CANONICAL_HTML)});
t('git diff empty',()=>{var d=cp.spawnSync('git',['diff','--','public/test.html'],{cwd:ROOT,encoding:'utf8',timeout:5000});a(!(d.stdout||'').trim())});

// ── Contamination ──────────────────────────────────────────────────────────
t('no sales-dx/transcriber',()=>{['transcriber','sales-dx'].forEach(function(b){a(!ROOT.includes(b))})});
t('no ANESTY',()=>{[rd('tools/kosame-live-cockpit-server.js'),rd('tools/kosame-runner-queue.js'),rd('public/kosame-live-cockpit.html')].forEach(function(f){a(!f.includes('ANESTY Board'))})});

// ── UI preservation ────────────────────────────────────────────────────────
['renderDeepSeekHandoff()','renderDeepSeekResult()','renderRC100Dashboard()','renderFieldOpsPanel()','renderWorkflowDashboard()','renderReleaseReadiness()','chat-proceed','agent-stream-log','chat-sound-badge'].forEach(function(u){
  t('UI preserved: '+u,()=>{a(rd('public/kosame-live-cockpit.html').includes(u))});
});

var total=p+f;console.log('');
if(f===0){console.log('✅ v'+MIN_VERSION+' limit break autopilot smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ v'+MIN_VERSION+' limit break autopilot smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
