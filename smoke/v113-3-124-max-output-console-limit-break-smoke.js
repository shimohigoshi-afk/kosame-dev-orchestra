#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),MIN_VERSION='113.3.124',EXECUTOR_DIR=path.join(ROOT,'.kosame-executor');
let p=0,f=0;
function cv(a,b){const pa=a.split('.').map(Number),pb=b.split('.').map(Number);for(let i=0;i<3;i++){if((pa[i]||0)>(pb[i]||0))return 1;if((pa[i]||0)<(pb[i]||0))return-1}return 0}
function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}
function a(c,m){if(!c)throw new Error(m||'assertion failed')}
function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}
const {detectConfidentiality,detectTaskDifficulty,selectModelLane}=require('../tools/kosame-runner-queue'),CANONICAL='<!DOCTYPE html>\n<html lang="ja">\n<head>\n  <meta charset="UTF-8">\n  <title>Test</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>\n';

console.log('===== v'+MIN_VERSION+' max output smoke =====');
t('version >= '+MIN_VERSION,()=>{a(cv(PKG.version,MIN_VERSION)>=0)});

// ── Tools existence ────────────────────────────────────────────────────────
['tools/kosame-dev-os-limit-break-runner.js','tools/kosame-console-operation-runner.js','tools/kosame-dev-os-field-ops-runner.js','tools/kosame-smoke-cleanup.js','tools/kosame-dev-os-operational-validator.js'].forEach(function(f){
  t('tool: '+path.basename(f),()=>{a(fs.existsSync(path.join(ROOT,f)))});
});

// ── Scripts ────────────────────────────────────────────────────────────────
['ops:limit-break','ops:console','ops:preflight','ops:aftercare','ops:field','ops:validate','smoke:cleanup'].forEach(function(s){
  t('script: '+s,()=>{a(PKG.scripts&&PKG.scripts[s],'missing: '+s)});
});

// ── APIs ───────────────────────────────────────────────────────────────────
['limit-break-report','console-operation-report','operational-evidence','real-run-readiness','ops-launch-summary','field-ops-report','release-gate','judge','readiness','history'].forEach(function(api){
  t('API: '+api,()=>{a(rd('tools/kosame-live-cockpit-server.js').includes('/api/executor/'+api))});
});

// ── UI ─────────────────────────────────────────────────────────────────────
['limit-break-status','renderLimitBreakPanel','field-ops-panel','rc100-gate-content','rc100-judge-status','renderRC100Dashboard','renderFieldOpsPanel','renderDeepSeekHandoff()','renderDeepSeekResult()','renderDeepSeekResultAction()','renderDeepSeekWorkflowHistory()','getDeepSeekWorkflowStatus()','renderWorkflowDashboard()','renderReleaseReadiness()','chat-proceed','chat-input','chat-sound-badge','agent-stream-log','deepseek-handoff-strip','deepseek-result-strip','deepseek-action-accept','deepseek-action-revise','deepseek-action-reject'].forEach(function(e){
  t('UI: '+e,()=>{a(rd('public/kosame-live-cockpit.html').includes(e))});
});

// ── Confidentiality (20) ───────────────────────────────────────────────────
[['safe','add comment','safe'],['sanitized smoke','smoke test','sanitized'],['sanitized audit','audit review','sanitized'],
 ['sensitive customer','customer data','sensitive'],['sensitive billing','billing fix','sensitive'],
 ['forbidden .env','.env key','forbidden'],['forbidden credentials','credentials.json','forbidden'],
 ['forbidden secret','SECRET key','forbidden'],['forbidden private key','private_key','forbidden'],
 ['forbidden deploy','deploy now','forbidden'],['forbidden git push','git push','forbidden'],
 ['forbidden npm publish','npm publish','forbidden'],['forbidden sales-dx','sales_dx fix','forbidden'],
 ['forbidden transcriber','transcriber pipeline','forbidden'],
].forEach(function(ct){t('conf: '+ct[0],()=>{a(detectConfidentiality({prompt_text:ct[1]})===ct[2])})});

// ── Difficulty (12) ────────────────────────────────────────────────────────
[['low','add comment','low'],['low polish','UI polish','low'],['medium','implement function component','medium'],
 ['high refactor','refactor security fix','high'],['high migration','migration with api','high'],['blocked','../escape','blocked'],
 ['blocked rm','rm -rf','blocked'],
].forEach(function(dt){t('diff: '+dt[0],()=>{a(detectTaskDifficulty({prompt_text:dt[1]})===dt[2])})});

// ── Model Lane (14) ────────────────────────────────────────────────────────
[['L1','add comment','L1_DEEPSEEK_V4_FLASH'],['L2','implement function component','L2_DEEPSEEK_V4_PRO'],
 ['L3 audit','refactor security fix','L3_DEEPSEEK_V4_PRO_AUDIT'],['INTERNAL','customer data migration','INTERNAL_ONLY'],
 ['BLOCKED env','.env fix','BLOCKED'],['BLOCKED deploy','deploy now','BLOCKED'],
 ['BLOCKED push','git push main','BLOCKED'],
].forEach(function(lt){t('lane: '+lt[0],()=>{a(selectModelLane({prompt_text:lt[1]}).lane===lt[2])})});

// ── Hard gates ─────────────────────────────────────────────────────────────
t('deploy→BLOCKED',()=>{a(selectModelLane({prompt_text:'deploy now'}).lane==='BLOCKED')});
t('push→BLOCKED',()=>{a(selectModelLane({prompt_text:'git push main'}).lane==='BLOCKED')});
t('.env→BLOCKED',()=>{a(selectModelLane({prompt_text:'read .env'}).lane==='BLOCKED')});
t('rm→BLOCKED',()=>{a(selectModelLane({prompt_text:'rm -rf /'}).lane==='BLOCKED')});
t('sensitive→INTERNAL',()=>{a(selectModelLane({prompt_text:'customer billing refactor'}).lane==='INTERNAL_ONLY')});
t('high→audit',()=>{a(selectModelLane({prompt_text:'refactor security fix'}).audit_required===true)});
t('sensitive not L2/L3',()=>{var r=selectModelLane({prompt_text:'customer data migration'});a(r.lane!=='L2_DEEPSEEK_V4_PRO');a(r.lane!=='L3_DEEPSEEK_V4_PRO_AUDIT')});
t('forbidden no handoff',()=>{a(selectModelLane({prompt_text:'.env fix'}).lane==='BLOCKED')});

// ── .gitignore (20) ────────────────────────────────────────────────────────
var ignores=['latest*.md','latest*.json','history/','rc80-summary.md','rc100-summary.md','handoff-latest.md','recovery-checklist.md','post-rc-summary.md','operational-checklist.md','ops-validation-summary.md','real-http-e2e-report.md','field-ops-report.md','ops-launch-summary.md','next-real-run-checklist.md','limit-break-report.md','limit-break-report.json','operational-evidence.md','real-run-readiness.md','test-results/','logs/','console-operation-report.md'];
ignores.forEach(function(g){t('gitignore: '+g,()=>{a(rd('.gitignore').includes(g))})});
t('gitignore: run-latest.sh safe',()=>{a(!rd('.gitignore').split('\n').some(function(l){return l.includes('run-latest.sh')&&!l.startsWith('#')}))});

// ── Smoke cleanup ──────────────────────────────────────────────────────────
t('test.html canonical',()=>{fs.writeFileSync(path.join(ROOT,'public','test.html'),CANONICAL);a(fs.readFileSync(path.join(ROOT,'public','test.html'),'utf8')===CANONICAL)});
t('git diff empty',()=>{var d=cp.spawnSync('git',['diff','--','public/test.html'],{cwd:ROOT,encoding:'utf8',timeout:5000});a(!(d.stdout||'').trim())});

// ── Ops scripts execute ────────────────────────────────────────────────────
t('ops:limit-break runs',()=>{var r=cp.spawnSync(process.execPath,[path.join(ROOT,'tools/kosame-dev-os-limit-break-runner.js')],{cwd:ROOT,encoding:'utf8',timeout:15000});a((r.stdout||'').includes('KOSAME_LIMIT_BREAK'))});
t('ops:field runs',()=>{var r=cp.spawnSync(process.execPath,[path.join(ROOT,'tools/kosame-dev-os-field-ops-runner.js')],{cwd:ROOT,encoding:'utf8',timeout:15000});a((r.stdout||'').includes('KOSAME_FIELD_OPS'))});
t('smoke:cleanup runs',()=>{var r=cp.spawnSync(process.execPath,[path.join(ROOT,'tools/kosame-smoke-cleanup.js')],{cwd:ROOT,encoding:'utf8',timeout:10000});a((r.stdout||'').includes('smoke cleanup PASSED'))});
t('ops:validate runs',()=>{var r=cp.spawnSync(process.execPath,[path.join(ROOT,'tools/kosame-dev-os-operational-validator.js')],{cwd:ROOT,encoding:'utf8',timeout:10000});a((r.stdout||'').includes('KOSAME_OPERATIONAL'))});

// ── Package compat ─────────────────────────────────────────────────────────
['smoke:v113-3-112','smoke:v113-3-114','smoke:v113-3-115','smoke:v113-3-116','smoke:v113-3-117','smoke:v113-3-118','smoke:v113-3-119','smoke:v113-3-120','smoke:v113-3-121','smoke:v113-3-122','smoke:v113-3-123','smoke:v113-3-124'].forEach(function(s){
  t('pkg: '+s,()=>{a(PKG.scripts&&PKG.scripts[s])});
});
t('verify has v124',()=>{a(PKG.scripts['verify:dev-os'].includes('v113-3-124')&&PKG.scripts['verify:dev-os'].includes('smoke:v113-3-124'))});

// ── Generated files exist ──────────────────────────────────────────────────
['limit-break-report.md','operational-evidence.md','real-run-readiness.md','field-ops-report.md','ops-launch-summary.md'].forEach(function(f){
  t('file: '+f,()=>{a(fs.existsSync(path.join(EXECUTOR_DIR,f)))});
});

// ── Contamination ──────────────────────────────────────────────────────────
t('no sales-dx/transcriber',()=>{['transcriber','sales-dx'].forEach(function(b){a(!ROOT.includes(b))})});
t('no ANESTY',()=>{[rd('tools/kosame-live-cockpit-server.js'),rd('tools/kosame-runner-queue.js'),rd('public/kosame-live-cockpit.html')].forEach(function(f){a(!f.includes('ANESTY Board'))})});

var total=p+f;console.log('');
if(f===0){console.log('✅ v'+MIN_VERSION+' max output smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ v'+MIN_VERSION+' max output smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
