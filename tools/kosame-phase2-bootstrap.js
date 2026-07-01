#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),STATE_DIR=path.join(ROOT,'.kosame-state');

function load(name){
  try{return JSON.parse(fs.readFileSync(path.join(STATE_DIR,name),'utf8'))}catch(_){return{}}
}
function save(name,data){
  fs.mkdirSync(STATE_DIR,{recursive:true});
  fs.writeFileSync(path.join(STATE_DIR,name),JSON.stringify({...data,updated_at:new Date().toISOString()},null,2)+'\n');
}

// Save current mission state
const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
const exDir=path.join(ROOT,'.kosame-executor');
let latest={lane:'unknown',status:'unknown',confid:'unknown',diff:'unknown'};
try{const lc=fs.readFileSync(path.join(exDir,'latest.md'),'utf8');['lane','status','confidentiality','difficulty'].forEach(function(k){const m=lc.match(new RegExp('^'+k+':\\s*(.+)$','m'));if(m)latest[k]=m[1].trim()})}catch(_){}

let judge='pending_judge';
try{judge=JSON.parse(fs.readFileSync(path.join(exDir,'latest-judge.json'),'utf8')).judge_status||'pending_judge'}catch(_){}

const vault={
  version:pkg.version,
  current_mission:latest,
  judge_status:judge,
  last_operation:process.argv[2]||'checkpoint',
  model_lane:latest.lane,
};
save('task-vault.json',vault);

// Next action logic
const nextActions=[];
if(judge==='pending_judge')nextActions.push('judge: review DeepSeek result and decide accept/revise/reject');
if(judge==='judge_accept')nextActions.push('release: check release gate before commit');
if(latest.status==='blocked')nextActions.push('blocked: resolve blocker: '+latest.lane);
nextActions.push('verify: run npm run verify');
nextActions.push('cleanup: run npm run smoke:cleanup');
save('next-actions.json',{actions:nextActions,count:nextActions.length});

// Auto-save with 50min time tracking
save('auto-save.json',{last_save:new Date().toISOString(),interval_min:50,next_save_due:new Date(Date.now()+50*60000).toISOString()});

// Chat-to-task seed
const chatTasks=[
  {type:'safe_low',examples:['UIの文言を修正','READMEに説明追加','見出しを変更']},
  {type:'safe_medium',examples:['APIとUIの連携を実装','ダッシュボードの表示を改善']},
  {type:'safe_high',examples:['RunnerとExecutorのリファクタリング','セキュリティ監査の実装']},
  {type:'human_gate',examples:['commitの承認','pushの確認','deployの判断']},
  {type:'forbidden',examples:['.envの書き換え','credentialsの更新','sales-dxの修正']},
];
save('chat-task-seed.json',{seeds:chatTasks,count:chatTasks.length});

// Cost meter mock data
const cost={
  deepseek:{total:0,flash:0,pro:0,pro_audit:0},
  gpt:{total:0,requests:0},
  gemini:{total:0,requests:0},
  groq:{total:0,requests:0},
  warning_threshold:5.0,
  current_total:0.0,
  high_cost_warning:false,
};
save('cost-meter.json',cost);

// Wishlist
save('wishlist.json',{
  items:[
    {id:1,idea:'Consoleダークモード',priority:'low',suggested_after:'v113.5.0'},
    {id:2,idea:'モバイル通知',priority:'low',suggested_after:'v114.0.0'},
    {id:3,idea:'Slack連携',priority:'medium',suggested_after:'v114.5.0'},
    {id:4,idea:'音声入力',priority:'low',suggested_after:'v115.0.0'},
    {id:5,idea:'作業時間自動記録',priority:'medium',suggested_after:'v113.6.0'},
  ],
  count:5,
});

// Recovery snapshot
const cp=require('node:child_process');
let gitHash='unknown';
try{gitHash=cp.spawnSync('git',['rev-parse','--short','HEAD'],{cwd:ROOT,encoding:'utf8',timeout:5000}).stdout.trim()}catch(_){}
save('last-known-good.json',{version:pkg.version,commit:gitHash,verify_hint:'npm run verify'});

console.log('KOSAME_PHASE2_BEGIN\nstatus: ready');
console.log('task_vault: saved ('+JSON.stringify(vault).slice(0,80)+'...)');
console.log('next_actions: '+nextActions.length+' items');
console.log('auto_save: 50min interval configured');
console.log('chat_seed: '+chatTasks.length+' templates');
console.log('cost_meter: initialized');
console.log('wishlist: '+5+' items');
console.log('recovery: last-known-good updated');
console.log('KOSAME_PHASE2_END');
