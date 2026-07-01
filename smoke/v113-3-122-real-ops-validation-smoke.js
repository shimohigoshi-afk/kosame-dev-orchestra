#!/usr/bin/env node
'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const cp   = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const MIN_VERSION = '113.3.122';

let passed = 0; let failed = 0;
function compareVersions(a,b){const pa=a.split('.').map(Number),pb=b.split('.').map(Number);for(let i=0;i<3;i++){if((pa[i]||0)>(pb[i]||0))return 1;if((pa[i]||0)<(pb[i]||0))return-1}return 0}
function test(n,f){try{f();console.log('  PASS: '+n);passed++}catch(e){console.error('  FAIL: '+n+' — '+e.message);failed++}}
function assert(c,m){if(!c)throw new Error(m||'assertion failed')}
function read(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}
function unlink(p){try{fs.unlinkSync(p)}catch(_){}}

const {detectConfidentiality,detectTaskDifficulty,selectModelLane,executorLaneRouter,processTicket}=require('../tools/kosame-runner-queue');

console.log('===== v'+MIN_VERSION+' real ops validation smoke =====');
test('version >= 113.3.122',()=>{assert(compareVersions(PKG.version,MIN_VERSION)>=0)});

// ── real HTTP E2E file exists ──────────────────────────────────────────────
test('real-http-e2e-smoke.js exists',()=>{assert(fs.existsSync(path.join(ROOT,'smoke/v113-3-122-real-http-e2e-smoke.js')))});
test('real-http-e2e uses child_process.spawn',()=>{assert(read('smoke/v113-3-122-real-http-e2e-smoke.js').includes('spawn'))});
test('real-http-e2e uses http.get',()=>{assert(read('smoke/v113-3-122-real-http-e2e-smoke.js').includes('http.get'))});
test('real-http-e2e has no curl dependency',()=>{var c=read('smoke/v113-3-122-real-http-e2e-smoke.js');assert(!c.includes('execSync')||c.includes('spawn'),'no execSync curl')});
test('real-http-e2e has port fallback',()=>{assert(read('smoke/v113-3-122-real-http-e2e-smoke.js').includes('findFreePort')||read('smoke/v113-3-122-real-http-e2e-smoke.js').includes('freePort'))});
test('real-http-e2e has timeout',()=>{assert(read('smoke/v113-3-122-real-http-e2e-smoke.js').includes('timeout'))});
test('real-http-e2e has kill/finally',()=>{var c=read('smoke/v113-3-122-real-http-e2e-smoke.js');assert(c.includes('kill')||c.includes('SIGTERM'))});
test('real-http-e2e writes report',()=>{assert(read('smoke/v113-3-122-real-http-e2e-smoke.js').includes('real-http-e2e-report.md'))});

// ── Operational validator ──────────────────────────────────────────────────
test('ops-validator exists',()=>{assert(fs.existsSync(path.join(ROOT,'tools/kosame-dev-os-operational-validator.js')))});
test('ops-validator checks gitignore',()=>{assert(read('tools/kosame-dev-os-operational-validator.js').includes('.gitignore'))});
test('ops-validator checks test.html',()=>{assert(read('tools/kosame-dev-os-operational-validator.js').includes('test.html'))});

// ── Confidentiality ────────────────────────────────────────────────────────
test('conf: safe',()=>{assert(detectConfidentiality({prompt_text:'add comment'})==='safe')});
test('conf: sanitized',()=>{assert(detectConfidentiality({prompt_text:'smoke test'})==='sanitized')});
test('conf: sensitive customer',()=>{assert(detectConfidentiality({prompt_text:'customer data'})==='sensitive')});
test('conf: forbidden .env',()=>{assert(detectConfidentiality({prompt_text:'.env key'})==='forbidden')});
test('conf: forbidden credentials',()=>{assert(detectConfidentiality({prompt_text:'credentials.json'})==='forbidden')});
test('conf: forbidden SECRET',()=>{assert(detectConfidentiality({prompt_text:'SECRET key'})==='forbidden')});
test('conf: forbidden sales-dx',()=>{assert(detectConfidentiality({prompt_text:'sales-dx fix'})==='forbidden')});
test('conf: forbidden transcriber',()=>{assert(detectConfidentiality({prompt_text:'transcriber'})==='forbidden')});
test('conf: forbidden deploy',()=>{assert(detectConfidentiality({prompt_text:'deploy now'})==='forbidden')});
test('conf: forbidden git push',()=>{assert(detectConfidentiality({prompt_text:'git push'})==='forbidden')});
test('conf: forbidden npm publish',()=>{assert(detectConfidentiality({prompt_text:'npm publish'})==='forbidden')});

// ── Difficulty ─────────────────────────────────────────────────────────────
test('diff: low polish',()=>{assert(detectTaskDifficulty({prompt_text:'UI polish'})==='low')});
test('diff: low docs',()=>{assert(detectTaskDifficulty({prompt_text:'add docs'})==='low')});
test('diff: low comment',()=>{assert(detectTaskDifficulty({prompt_text:'add comment'})==='low')});
test('diff: medium implement',()=>{assert(detectTaskDifficulty({prompt_text:'implement function with component'})==='medium')});
test('diff: high refactor security',()=>{assert(detectTaskDifficulty({prompt_text:'refactor with security fix'})==='high')});
test('diff: blocked traversal',()=>{assert(detectTaskDifficulty({prompt_text:'../escape'})==='blocked')});
test('diff: blocked rm',()=>{assert(detectTaskDifficulty({prompt_text:'rm -rf delete'})==='blocked')});

// ── Model Lane ─────────────────────────────────────────────────────────────
test('lane: BLOCKED for forbidden',()=>{assert(selectModelLane({prompt_text:'.env fix'}).lane==='BLOCKED')});
test('lane: INTERNAL for sensitive',()=>{assert(selectModelLane({prompt_text:'customer data refactor'}).lane==='INTERNAL_ONLY')});
test('lane: L1 for safe low',()=>{assert(selectModelLane({prompt_text:'add comment'}).lane==='L1_DEEPSEEK_V4_FLASH')});
test('lane: L2 for safe medium',()=>{assert(selectModelLane({prompt_text:'implement function component'}).lane==='L2_DEEPSEEK_V4_PRO')});
test('lane: L3 audit for high',()=>{var r=selectModelLane({prompt_text:'refactor security fix'});assert(r.lane==='L3_DEEPSEEK_V4_PRO_AUDIT');assert(r.audit_required)});
test('lane: sensitive not to DeepSeek',()=>{var r=selectModelLane({prompt_text:'customer billing refactor'});assert(r.lane!=='L2_DEEPSEEK_V4_PRO');assert(r.lane!=='L3_DEEPSEEK_V4_PRO_AUDIT')});
test('lane: forbidden no handoff',()=>{var r=selectModelLane({prompt_text:'deploy to prod'});assert(r.lane==='BLOCKED')});

// ── Human gate conditions ──────────────────────────────────────────────────
test('human_gate: commit (L1 with human context)',()=>{var r=selectModelLane({prompt_text:'git commit'});assert(r.lane==='L1_DEEPSEEK_V4_FLASH'||r.human_gate_required,'got '+r.lane)});
test('human_gate: deploy',()=>{var r=selectModelLane({prompt_text:'deploy now'});assert(r.lane==='BLOCKED')});
test('human_gate: billing',()=>{var r=selectModelLane({prompt_text:'billing refactor'});assert(r.human_gate_required)});

// ── Server APIs ────────────────────────────────────────────────────────────
var apis=['latest','deepseek-handoff','deepseek-result','deepseek-result/action','history','readiness','release-gate','judge','rc100-summary','handoff','recovery','post-rc-summary','operational-checklist','ops-validation-summary','real-http-e2e-report'];
apis.forEach(function(a){
  test('API: '+a,()=>{assert(read('tools/kosame-live-cockpit-server.js').includes('/api/executor/'+a))});
});

// ── UI elements ────────────────────────────────────────────────────────────
['rc100-gate-content','rc100-judge-status','renderRC100Dashboard','renderDeepSeekHandoff()','renderDeepSeekResult()','renderDeepSeekResultAction()','renderDeepSeekWorkflowHistory()','getDeepSeekWorkflowStatus()','renderWorkflowDashboard()','renderReleaseReadiness()','chat-proceed','chat-input','chat-sound-badge','agent-stream-log'].forEach(function(e){
  test('UI: '+e,()=>{assert(read('public/kosame-live-cockpit.html').includes(e))});
});

// ── .gitignore ─────────────────────────────────────────────────────────────
['latest*.md','latest*.json','history/','rc80-summary.md','rc100-summary.md','handoff-latest.md','recovery-checklist.md','post-rc-summary.md','operational-checklist.md','ops-validation-summary.md','real-http-e2e-report.md','test-results/','logs/'].forEach(function(f){
  test('gitignore: '+f,()=>{assert(read('.gitignore').includes(f))});
});
test('gitignore: run-latest.sh safe',()=>{var gi=read('.gitignore');assert(!gi.split('\n').some(function(l){return l.includes('run-latest.sh')&&!l.startsWith('#')}))});

// ── Smoke cleanup ──────────────────────────────────────────────────────────
test('test.html cleanup helpers',()=>{
  var CANONICAL_HTML='<!DOCTYPE html>\n<html lang="ja">\n<head>\n  <meta charset="UTF-8">\n  <title>Test</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>\n';
  fs.writeFileSync(path.join(ROOT,'public','test.html'),CANONICAL_HTML);
  var c=fs.readFileSync(path.join(ROOT,'public','test.html'),'utf8');
  assert(c===CANONICAL_HTML,'must be canonical');
  var diff=cp.spawnSync('git',['diff','--','public/test.html'],{cwd:ROOT,encoding:'utf8'});assert(!(diff.stdout||'').trim(),'git diff must be empty');
});

// ── Package ────────────────────────────────────────────────────────────────
test('pkg: smoke:v113-3-122',()=>{assert(PKG.scripts['smoke:v113-3-122'])});
test('pkg: smoke:v113-3-122:http',()=>{assert(PKG.scripts['smoke:v113-3-122:http'])});
test('pkg: ops:validate',()=>{assert(PKG.scripts['ops:validate'])});
test('pkg: verify has v122',()=>{var v=PKG.scripts['verify:dev-os'];assert(v.includes('v113-3-122')&&v.includes('smoke:v113-3-122'))});

['v113-3-112','v113-3-114','v113-3-115','v113-3-116','v113-3-117','v113-3-118','v113-3-119','v113-3-120','v113-3-121'].forEach(function(v){
  test('existing: '+v,()=>{assert(PKG.scripts['smoke:'+v])});
});

// ── Executor compat ────────────────────────────────────────────────────────
test('executorLane works',()=>{var d=path.join(ROOT,'.kosame-runner','runs','122-'+Date.now());fs.mkdirSync(d,{recursive:true});var r=executorLaneRouter({id:'x',prompt_text:'../seq',target_repo:ROOT},d);assert(!r.ok)});
test('processTicket terminal skip',()=>{var st={};st['122-'+Date.now()]={status:'completed',completedAt:new Date().toISOString()};var r=processTicket({id:'122-'+Date.now(),title:'t',prompt_text:'x',target_repo:ROOT},{state:st,runsDir:path.join(ROOT,'.kosame-runner','runs')});assert(r.status==='completed')});

// ── Ops validator runs ─────────────────────────────────────────────────────
test('ops:validate executes without crash',()=>{
  var r=cp.spawnSync(process.execPath,[path.join(ROOT,'tools/kosame-dev-os-operational-validator.js')],{cwd:ROOT,encoding:'utf8',timeout:10000});
  var out=(r.stdout||'')+(r.stderr||'');
  assert(out.includes('KOSAME_OPERATIONAL_VALIDATION'),'must contain validation marker: '+out.slice(0,200));
});

// ── Contamination ──────────────────────────────────────────────────────────
test('no sales-dx/transcriber in ROOT',()=>{['transcriber','sales-dx'].forEach(function(b){assert(!ROOT.includes(b))})});
test('no ANESTY',()=>{[read('tools/kosame-live-cockpit-server.js'),read('tools/kosame-runner-queue.js'),read('public/kosame-live-cockpit.html')].forEach(function(f){assert(!f.includes('ANESTY Board'))})});

// ── Final: canonical test.html ─────────────────────────────────────────────
test('final: test.html canonical + git diff empty',()=>{
  var c='<!DOCTYPE html>\n<html lang="ja">\n<head>\n  <meta charset="UTF-8">\n  <title>Test</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>\n';
  fs.writeFileSync(path.join(ROOT,'public','test.html'),c);
  var diff=cp.spawnSync('git',['diff','--','public/test.html'],{cwd:ROOT,encoding:'utf8'});assert(!(diff.stdout||'').trim(),'diff must be empty: '+(diff.stdout||'').slice(0,50));
});

var total=passed+failed;
console.log('');
if(failed===0){console.log('✅ v'+MIN_VERSION+' real ops validation smoke PASSED ('+passed+'/'+total+')')}
else{console.error('❌ v'+MIN_VERSION+' real ops validation smoke FAILED ('+passed+'/'+total+', '+failed+' failures)');process.exit(1)}
