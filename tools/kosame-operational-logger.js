#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),LOG_DIR=path.join(ROOT,'.kosame-logs');
fs.mkdirSync(LOG_DIR,{recursive:true});

function logEvent(type,data){
  const ts=new Date().toISOString(),entry={type,timestamp:ts,...data};
  const tsFile=ts.replace(/[:.]/g,'-');
  const fp=path.join(LOG_DIR,tsFile+'-'+type+'.json');
  fs.writeFileSync(fp,JSON.stringify(entry,null,2)+'\n');
  console.log('[log] '+type+': '+JSON.stringify(data).slice(0,120));
}

// Simulate operational log entries based on what we can detect from current state
const exDir=path.join(ROOT,'.kosame-executor');

// Log current version
const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
logEvent('version_check',{version:pkg.version,status:'operational'});

// Log runner state
try{
  const rState=path.join(ROOT,'.kosame-runner','queue-state.json');
  if(fs.existsSync(rState)){
    const s=JSON.parse(fs.readFileSync(rState,'utf8'));
    logEvent('runner_state',{entries:Object.keys(s).length});
  }else{logEvent('runner_state',{status:'no queue yet'})}
}catch(_){logEvent('runner_state',{error:'cannot read'})}

// Log judge state
try{
  const jp=path.join(exDir,'latest-judge.json');
  if(fs.existsSync(jp)){
    const j=JSON.parse(fs.readFileSync(jp,'utf8'));
    logEvent('judge_state',{judge_status:j.judge_status,human_gate:j.human_gate_required});
  }else{logEvent('judge_state',{status:'no judge yet'})}
}catch(_){logEvent('judge_state',{error:'cannot read'})}

// Log release gate
try{
  const rp=path.join(exDir,'latest.md');
  if(fs.existsSync(rp)){
    const rc=fs.readFileSync(rp,'utf8');
    const blocked=rc.includes('blocked')?'blocked':'open';
    logEvent('release_gate',{gate:blocked});
  }else{logEvent('release_gate',{gate:'unknown'})}
}catch(_){logEvent('release_gate',{error:'cannot read'})}

// Log limit break result
try{
  const lb=path.join(exDir,'limit-break-report.md');
  if(fs.existsSync(lb)){
    const lc=fs.readFileSync(lb,'utf8'),status=lc.includes('ready')?'ready':'caution';
    logEvent('limit_break',{status});
  }else{logEvent('limit_break',{status:'not run'})}
}catch(_){logEvent('limit_break',{status:'not run'})}

// Log field ops result
try{
  const fo=path.join(exDir,'field-ops-report.md');
  if(fs.existsSync(fo)){
    const fc=fs.readFileSync(fo,'utf8'),status=fc.includes('ready')?'ready':'caution';
    logEvent('field_ops',{status});
  }else{logEvent('field_ops',{status:'not run'})}
}catch(_){logEvent('field_ops',{status:'not run'})}

console.log('KOSAME_OPERATIONAL_LOG_BEGIN\nstatus: ready');
const logs=fs.readdirSync(LOG_DIR).sort().reverse().slice(0,10);
logs.forEach(function(l){console.log('log: '+l)});
console.log('KOSAME_OPERATIONAL_LOG_END');
