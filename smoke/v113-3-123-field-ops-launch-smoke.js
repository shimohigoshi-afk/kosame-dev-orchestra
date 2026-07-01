#!/usr/bin/env node
'use strict';

const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),MIN_VERSION='113.3.123',EXECUTOR_DIR=path.join(ROOT,'.kosame-executor'),RUNS_DIR=path.join(ROOT,'.kosame-runner','runs'),CANONICAL_HTML='<!DOCTYPE html>\n<html lang="ja">\n<head>\n  <meta charset="UTF-8">\n  <title>Test</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>\n';
let p=0,f=0;
function cv(a,b){const pa=a.split('.').map(Number),pb=b.split('.').map(Number);for(let i=0;i<3;i++){if((pa[i]||0)>(pb[i]||0))return 1;if((pa[i]||0)<(pb[i]||0))return-1}return 0}
function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}
function a(c,m){if(!c)throw new Error(m||'assertion failed')}
function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}
const {detectConfidentiality,detectTaskDifficulty,selectModelLane}=require('../tools/kosame-runner-queue');

console.log('===== v'+MIN_VERSION+' field ops launch smoke =====');
t('version >= 113.3.123',()=>{a(cv(PKG.version,MIN_VERSION)>=0)});

// ── Field Ops Runner ──
t('field-ops-runner exists',()=>{a(fs.existsSync(path.join(ROOT,'tools/kosame-dev-os-field-ops-runner.js')))});
t('ops:field script exists',()=>{a(PKG.scripts['ops:field'])});
t('field-ops-runner uses selectModelLane',()=>{a(rd('tools/kosame-dev-os-field-ops-runner.js').includes('selectModelLane'))});
t('field-ops-runner has 15+ scenarios',()=>{a(rd('tools/kosame-dev-os-field-ops-runner.js').includes('prompt_text')||rd('tools/kosame-dev-os-field-ops-runner.js').includes('SCENARIOS'))});

// ── Field Ops API ──
t('server has field-ops-report API',()=>{a(rd('tools/kosame-live-cockpit-server.js').includes('/api/executor/field-ops-report'))});
t('server has ops-launch-summary API',()=>{a(rd('tools/kosame-live-cockpit-server.js').includes('/api/executor/ops-launch-summary'))});
t('server has next-real-run-checklist API',()=>{a(rd('tools/kosame-live-cockpit-server.js').includes('/api/executor/next-real-run-checklist'))});

// ── Smoke cleanup ──
t('smoke-cleanup exists',()=>{a(fs.existsSync(path.join(ROOT,'tools/kosame-smoke-cleanup.js')))});
t('smoke:cleanup script exists',()=>{a(PKG.scripts['smoke:cleanup'])});
t('smoke-cleanup restores canonical',()=>{a(rd('tools/kosame-smoke-cleanup.js').includes('CANONICAL_HTML'))});
t('smoke-cleanup checks markers',()=>{a(rd('tools/kosame-smoke-cleanup.js').includes('KOSAME_UNIQUE'))});
t('smoke-cleanup checks git diff',()=>{a(rd('tools/kosame-smoke-cleanup.js').includes('git diff'))});

// ── Confidentiality scenarios ──
const confTests=[
  ['safe low: UI polish',  'UI polish color labels',  'safe'],[ 'safe low: docs', 'add docs to README', 'safe'],
  ['safe medium: API+UI',  'implement api with ui component',  'safe'],[ 'safe high: runner executor', 'refactor runner executor with state management migration', ['safe','sensitive']],
  ['forbidden: .env',      '.env key fix',  'forbidden'],[ 'forbidden: credentials', 'credentials.json auth', 'forbidden'],
  ['forbidden: SECRET',    'SECRET token check',  'forbidden'],[ 'forbidden: deploy', 'deploy now', 'forbidden'],
  ['forbidden: git push',  'git push origin',  'forbidden'],[ 'forbidden: npm publish', 'npm publish', 'forbidden'],
  ['forbidden: sales-dx',  'sales-dx update',  'forbidden'],[ 'forbidden: transcriber', 'transcriber fix', 'forbidden'],
  ['sensitive: customer',  'customer data migration',  'sensitive'],[ 'sensitive: billing', 'billing system fix', 'sensitive'],
  ['sensitive: insurance', 'insurance logic calc',  'sensitive'],
];
confTests.forEach(function(ct){
  t('conf scenario: '+ct[0],function(){
    var actual=detectConfidentiality({prompt_text:ct[1]});
    var expected=ct[2];
    if(Array.isArray(expected))a(expected.indexOf(actual)>=0,ct[0]+' got '+actual+' expected '+JSON.stringify(expected));
    else a(actual===expected,ct[0]+' got '+actual);
  });
});

// ── Difficulty scenarios ──
[['low: polish','UI polish','low'],['low: docs','add docs','low'],['medium: impl func','implement function component','medium'],['high: refactor security','refactor security fix','high'],['high: runner executor security','refactor runner executor with security migration','high'],['blocked: ..','../escape','blocked'],['blocked: rm','rm -rf delete','blocked']].forEach(function(dt){
  t('diff scenario: '+dt[0],()=>{a(detectTaskDifficulty({prompt_text:dt[1]})===dt[2],'got '+detectTaskDifficulty({prompt_text:dt[1]}))});
});

// ── Model Lane scenarios ──
[['L1 safe low','add comment','L1_DEEPSEEK_V4_FLASH'],['L2 safe medium','implement function component','L2_DEEPSEEK_V4_PRO'],['L3 safe high audit','refactor security fix','L3_DEEPSEEK_V4_PRO_AUDIT'],['BLOCKED .env','.env fix','BLOCKED'],['BLOCKED deploy','deploy now','BLOCKED'],['INTERNAL customer','customer data migration','INTERNAL_ONLY'],['INTERNAL insurance','insurance refactor','INTERNAL_ONLY']].forEach(function(lt){
  t('lane scenario: '+lt[0],()=>{a(selectModelLane({prompt_text:lt[1]}).lane===lt[2],'got '+selectModelLane({prompt_text:lt[1]}).lane)});
});

// ── Human gate / blocked checks ──
t('deploy→BLOCKED',()=>{a(selectModelLane({prompt_text:'deploy now'}).lane==='BLOCKED')});
t('push→forbidden→BLOCKED',()=>{a(selectModelLane({prompt_text:'git push main'}).lane==='BLOCKED')});
t('.env→BLOCKED',()=>{a(selectModelLane({prompt_text:'read .env'}).lane==='BLOCKED')});
t('rm -rf→BLOCKED',()=>{a(selectModelLane({prompt_text:'rm -rf /'}).lane==='BLOCKED')});
t('sensitive→INTERNAL_ONLY',()=>{a(selectModelLane({prompt_text:'customer billing refactor'}).lane==='INTERNAL_ONLY')});
t('forbidden→BLOCKED',()=>{a(selectModelLane({prompt_text:'credentials.json fix'}).lane==='BLOCKED')});
t('high→audit_required',()=>{a(selectModelLane({prompt_text:'refactor security fix'}).audit_required===true)});
t('sensitive not→DeepSeek',()=>{var r=selectModelLane({prompt_text:'customer data migration'});a(r.lane!=='L2_DEEPSEEK_V4_PRO');a(r.lane!=='L3_DEEPSEEK_V4_PRO_AUDIT')});

// ── UI elements ──
['field-ops-panel','field-ops-status','field-ops-run-btn','renderFieldOpsPanel','rc100-gate-content','rc100-judge-status','renderRC100Dashboard'].forEach(function(e){
  t('UI: '+e,()=>{a(rd('public/kosame-live-cockpit.html').includes(e))});
});

// ── All API endpoints ──
['latest','deepseek-handoff','deepseek-result','deepseek-result/action','history','readiness','release-gate','judge','rc100-summary','handoff','recovery','post-rc-summary','operational-checklist','ops-validation-summary','real-http-e2e-report','field-ops-report','ops-launch-summary','next-real-run-checklist'].forEach(function(api){
  t('API: '+api,function(){a(rd('tools/kosame-live-cockpit-server.js').includes('/api/executor/'+api))});
});

// ── .gitignore ──
['latest*.md','latest*.json','history/','rc80-summary.md','rc100-summary.md','handoff-latest.md','recovery-checklist.md','post-rc-summary.md','operational-checklist.md','ops-validation-summary.md','real-http-e2e-report.md','field-ops-report.md','ops-launch-summary.md','next-real-run-checklist.md','test-results/','logs/'].forEach(function(f){
  t('gitignore: '+f,()=>{a(rd('.gitignore').includes(f))});
});
t('gitignore: run-latest.sh safe',()=>{a(!rd('.gitignore').split('\n').some(function(l){return l.includes('run-latest.sh')&&!l.startsWith('#')}))});

// ── Package scripts ──
['smoke:v113-3-123','smoke:v113-3-122','smoke:v113-3-112','smoke:v113-3-114','smoke:v113-3-115','smoke:v113-3-116','smoke:v113-3-117','smoke:v113-3-118','smoke:v113-3-119','smoke:v113-3-120','smoke:v113-3-121','ops:validate','ops:field','smoke:cleanup'].forEach(function(s){
  t('pkg: '+s,function(){a(PKG.scripts&&PKG.scripts[s],'missing script: '+s)});
});
t('verify has v123',function(){a(PKG.scripts['verify:dev-os'].includes('v113-3-123')&&PKG.scripts['verify:dev-os'].includes('smoke:v113-3-123'))});

// ── Field Ops runner executes ──
t('ops:field runs without crash',()=>{
  var r=cp.spawnSync(process.execPath,[path.join(ROOT,'tools/kosame-dev-os-field-ops-runner.js')],{cwd:ROOT,encoding:'utf8',timeout:15000});
  var out=(r.stdout||'')+(r.stderr||'');
  a(out.includes('KOSAME_FIELD_OPS'),'must contain field ops marker: '+out.slice(0,200));
});

// ── Smoke cleanup executes ──
t('smoke:cleanup runs without crash',()=>{
  var r=cp.spawnSync(process.execPath,[path.join(ROOT,'tools/kosame-smoke-cleanup.js')],{cwd:ROOT,encoding:'utf8',timeout:10000});
  a((r.stdout||'').includes('smoke cleanup PASSED'),'must pass: '+((r.stdout||'')+(r.stderr||'')).slice(0,200));
});

// ── Generated files check ──
t('field-ops-report.md generated',()=>{a(fs.existsSync(path.join(EXECUTOR_DIR,'field-ops-report.md')))});
t('ops-launch-summary.md generated',()=>{a(fs.existsSync(path.join(EXECUTOR_DIR,'ops-launch-summary.md')))});
t('next-real-run-checklist.md generated',()=>{a(fs.existsSync(path.join(EXECUTOR_DIR,'next-real-run-checklist.md')))});

// ── Cleanup & canonical ──
t('test.html canonical',()=>{fs.writeFileSync(path.join(ROOT,'public','test.html'),CANONICAL_HTML);var c=fs.readFileSync(path.join(ROOT,'public','test.html'),'utf8');a(c===CANONICAL_HTML)});
t('git diff test.html empty',()=>{var d=cp.spawnSync('git',['diff','--','public/test.html'],{cwd:ROOT,encoding:'utf8',timeout:5000});a(!(d.stdout||'').trim(),'diff: '+(d.stdout||'').slice(0,50))});

// ── Contamination ──
t('no sales-dx/transcriber',()=>{['transcriber','sales-dx'].forEach(function(b){a(!ROOT.includes(b))})});
t('no ANESTY',()=>{[rd('tools/kosame-live-cockpit-server.js'),rd('tools/kosame-runner-queue.js'),rd('public/kosame-live-cockpit.html')].forEach(function(f){a(!f.includes('ANESTY Board'))})});

var total=p+f;console.log('');
if(f===0){console.log('✅ v'+MIN_VERSION+' field ops launch smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ v'+MIN_VERSION+' field ops launch smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
