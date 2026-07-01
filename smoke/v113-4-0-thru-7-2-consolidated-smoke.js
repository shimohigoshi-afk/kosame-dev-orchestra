#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),STATE_DIR=path.join(ROOT,'.kosame-state');
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}

console.log('===== v113.4.0-7.2 phase2-4 consolidated smoke =====');

// Run bootstrap
var r=cp.spawnSync(process.execPath,[path.join(ROOT,'tools/kosame-phase2-bootstrap.js')],{cwd:ROOT,encoding:'utf8',timeout:15000});
t('bootstrap runs',()=>{a((r.stdout||'').includes('KOSAME_PHASE2'),'no marker')});

// ── v113.4.0 Cockpit Chat Self-Test ────────────────────────────────────────
t('4.0: task-vault.json exists',()=>{a(fs.existsSync(path.join(STATE_DIR,'task-vault.json')))});
t('4.0: task-vault has version',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'task-vault.json'),'utf8')).version)});
t('4.0: task-vault has current_mission',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'task-vault.json'),'utf8')).current_mission)});

// ── v113.4.1 Task Vault Runtime Link ───────────────────────────────────────
t('4.1: task-vault has judge_status',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'task-vault.json'),'utf8')).judge_status)});
t('4.1: task-vault has model_lane',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'task-vault.json'),'utf8')).model_lane)});
t('4.1: task-vault has updated_at',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'task-vault.json'),'utf8')).updated_at)});

// ── v113.4.2 Auto Save 50min Lock ─────────────────────────────────────────
t('4.2: auto-save.json exists',()=>{a(fs.existsSync(path.join(STATE_DIR,'auto-save.json')))});
t('4.2: auto-save has interval_min',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'auto-save.json'),'utf8')).interval_min===50)});
t('4.2: auto-save has next_save_due',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'auto-save.json'),'utf8')).next_save_due)});

// ── v113.4.3 Current Mission Restore ───────────────────────────────────────
t('4.3: task-vault has current_mission.lane',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'task-vault.json'),'utf8')).current_mission.lane)});

// ── v113.4.4 Next Action Restore ──────────────────────────────────────────
t('4.4: next-actions.json exists',()=>{a(fs.existsSync(path.join(STATE_DIR,'next-actions.json')))});
t('4.4: next-actions has actions array',()=>{a(Array.isArray(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'next-actions.json'),'utf8')).actions))});
t('4.4: next-actions has count',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'next-actions.json'),'utf8')).count>0)});

// ── v113.4.5 Chat-to-Task Converter ───────────────────────────────────────
t('4.5: chat-task-seed.json exists',()=>{a(fs.existsSync(path.join(STATE_DIR,'chat-task-seed.json')))});
t('4.5: chat-task-seed has seeds',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'chat-task-seed.json'),'utf8')).seeds)});
t('4.5: 5 task templates',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'chat-task-seed.json'),'utf8')).count>=5)});

// ── v113.6.0 Cost Meter Runtime ───────────────────────────────────────────
t('6.0: cost-meter.json exists',()=>{a(fs.existsSync(path.join(STATE_DIR,'cost-meter.json')))});
t('6.0: cost-meter has deepseek',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'cost-meter.json'),'utf8')).deepseek)});

// ── v113.6.1 Provider別 Cost Breakdown ────────────────────────────────────
t('6.1: cost-meter has gpt/gemini/groq',()=>{var c=JSON.parse(fs.readFileSync(path.join(STATE_DIR,'cost-meter.json'),'utf8'));a(c.gpt&&c.gemini&&c.groq)});

// ── v113.6.2 Model Lane別 Cost Breakdown ──────────────────────────────────
t('6.2: cost-meter deepseek has flash/pro/pro_audit',()=>{var c=JSON.parse(fs.readFileSync(path.join(STATE_DIR,'cost-meter.json'),'utf8')).deepseek;a(c.flash!==undefined&&c.pro!==undefined&&c.pro_audit!==undefined)});

// ── v113.6.3 High Cost Warning ────────────────────────────────────────────
t('6.3: cost-meter has warning_threshold',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'cost-meter.json'),'utf8')).warning_threshold)});
t('6.3: cost-meter has high_cost_warning',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'cost-meter.json'),'utf8')).high_cost_warning===false)});

// ── v113.7.0 Wishlist Lite Runtime ────────────────────────────────────────
t('7.0: wishlist.json exists',()=>{a(fs.existsSync(path.join(STATE_DIR,'wishlist.json')))});
t('7.0: wishlist has items array',()=>{a(Array.isArray(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'wishlist.json'),'utf8')).items))});
t('7.0: wishlist has 5 items',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'wishlist.json'),'utf8')).count===5)});

// ── v113.7.1 Later Ideas Board ────────────────────────────────────────────
t('7.1: wishlist items have priority',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'wishlist.json'),'utf8')).items[0].priority)});

// ── v113.7.2 Suggested After Version ──────────────────────────────────────
t('7.2: wishlist items have suggested_after',()=>{a(JSON.parse(fs.readFileSync(path.join(STATE_DIR,'wishlist.json'),'utf8')).items[0].suggested_after)});

// ── Recovery / last-known-good ────────────────────────────────────────────
t('recovery: last-known-good.json exists',()=>{a(fs.existsSync(path.join(STATE_DIR,'last-known-good.json')))});
t('recovery: has version+commit',()=>{var d=JSON.parse(fs.readFileSync(path.join(STATE_DIR,'last-known-good.json'),'utf8'));a(d.version&&d.commit)});

// ── .kosame-state gitignored ──────────────────────────────────────────────
t('gitignore: .kosame-state',()=>{a(rd('.gitignore').includes('.kosame-state'))});

var total=p+f;console.log('');
if(f===0){console.log('✅ Phase 2-4 consolidated smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ Phase 2-4 consolidated smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
