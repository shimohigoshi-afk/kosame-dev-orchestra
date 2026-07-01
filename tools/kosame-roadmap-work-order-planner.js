#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),ROOT=path.resolve(__dirname,'..'),EXECUTOR_DIR=path.join(ROOT,'.kosame-executor');
const {detectConfidentiality,detectTaskDifficulty,selectModelLane}=require('./kosame-runner-queue');
const RD_PATH=path.join(EXECUTOR_DIR,'kosame-roadmap-canon.json');
if(!fs.existsSync(RD_PATH)){console.error('No roadmap canon. Run roadmap:canon first.');process.exit(1)}
const RD=JSON.parse(fs.readFileSync(RD_PATH,'utf8'));
const orders=RD.phases.filter(function(p){return compareVersions(p.id,'113.3.125')>=0}).slice(0,10).map(function(p){
  const ticket={prompt_text:p.summary,target_repo:ROOT};
  const conf=detectConfidentiality(ticket),diff=detectTaskDifficulty(ticket),lane=selectModelLane(ticket);
  return {
    phase_id:p.id,phase:p.phase,summary:p.summary,
    confidentiality:conf,difficulty:diff,model_lane:lane.lane,recommended_model:lane.model,
    audit_required:lane.audit_required,human_gate_required:lane.human_gate_required||p.gate,
    blocked:lane.lane==='BLOCKED',safe_for_deepseek:lane.lane.startsWith('L')&&!p.gate,
    deliverables:p.deliverables,dependencies:p.deps||[],
    handoff_ready:lane.lane.startsWith('L')&&!p.gate&&lane.confidentiality==='safe',
  };
});
function compareVersions(a,b){const pa=String(a).replace(/^v/,'').split('.').map(Number),pb=String(b).replace(/^v/,'').split('.').map(Number);for(let i=0;i<3;i++){if((pa[i]||0)>(pb[i]||0))return 1;if((pa[i]||0)<(pb[i]||0))return-1}return 0}
const output={
  generated_at:new Date().toISOString(),
  version:RD.version,
  open_orders:orders.filter(function(o){return!o.blocked&&o.handoff_ready}),
  blocked_orders:orders.filter(function(o){return o.blocked}),
  human_gate_orders:orders.filter(function(o){return o.human_gate_required&&!o.blocked}),
  safe_first:`The following work orders are safe for DeepSeek V4 Pro to handle:\n${orders.filter(function(o){return o.safe_for_deepseek}).map(function(o){return '- '+o.phase_id+': '+o.phase}).join('\n')}`,
};
fs.mkdirSync(EXECUTOR_DIR,{recursive:true});
fs.writeFileSync(path.join(EXECUTOR_DIR,'roadmap-work-orders.json'),JSON.stringify(output,null,2)+'\n');
var md=['# KOSAME Roadmap Work Orders','',`version: ${output.version}`,`generated_at: ${output.generated_at}`,'','## Open (Safe for DeepSeek V4 Pro)',''];
output.open_orders.forEach(function(o){md.push('- '+o.phase_id+': '+o.phase);md.push('  lane: '+o.model_lane+' diff: '+o.difficulty+' conf: '+o.confidentiality);md.push('  audit: '+o.audit_required+' gate: '+o.human_gate_required)});
md.push('','## Blocked (Forbidden Content)','');
output.blocked_orders.forEach(function(o){md.push('- '+o.phase_id+': '+o.phase+' (BLOCKED)')});
md.push('','## Human Gate Required','');
output.human_gate_orders.forEach(function(o){md.push('- '+o.phase_id+': '+o.phase+' (human gate)')});
md.push('','## Safe First Request','',output.safe_first);
fs.writeFileSync(path.join(EXECUTOR_DIR,'roadmap-work-orders.md'),md.join('\n'));
console.log('KOSAME_ROADMAP_WORK_ORDERS_BEGIN');
console.log('status: ready');
console.log('open: '+output.open_orders.length);
console.log('blocked: '+output.blocked_orders.length);
console.log('human_gate: '+output.human_gate_orders.length);
console.log('KOSAME_ROADMAP_WORK_ORDERS_END');
