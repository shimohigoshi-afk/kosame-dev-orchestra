#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}

console.log('===== Fable 5 final resort policy smoke =====');

// ── Persona ────────────────────────────────────────────────────────────────
var persona=rd('config/kosame-cockpit-chat-persona.md');
t('persona: Fable 5 mentioned',()=>{a(persona.includes('Fable 5'))});
t('persona: final_resort_lane mentioned',()=>{a(persona.includes('final_resort_lane'))});
t('persona: 常用禁止',()=>{a(persona.includes('常用禁止')||persona.includes('禁止'))});
t('persona: 投入条件 (2回以上)',()=>{a(persona.includes('2回以上'))});
t('persona: 投入条件 (JS/DOM)',()=>{a(persona.includes('JS')&&persona.includes('DOM'))});
t('persona: 投入理由明記ルール',()=>{a(persona.includes('理由を明記'))});
t('persona: 通常 DeepSeek/Gemini/Llama/Claude',()=>{a(persona.includes('DeepSeek')&&persona.includes('Gemini'))});

// ── Policy doc ─────────────────────────────────────────────────────────────
t('docs: fable5-final-resort-policy.md exists',()=>{a(fs.existsSync(path.join(ROOT,'docs','fable5-final-resort-policy.md')))});
var policy=rd('docs/fable5-final-resort-policy.md');
t('policy: final_resort_lane',()=>{a(policy.includes('final_resort_lane'))});
t('policy: 常用禁止',()=>{a(policy.includes('常用禁止'))});
t('policy: 投入条件6項目',()=>{a(policy.includes('2回以上')||policy.includes('根本原因'))});
t('policy: 禁止事項セクション',()=>{a(policy.includes('禁止事項'))});
t('policy: 通常レーン表',()=>{a(policy.includes('DeepSeek')&&policy.includes('Gemini')&&policy.includes('Claude'))});
t('policy: Model Lane定義',()=>{a(policy.includes('final_resort_lane')&&policy.includes('default_enabled'))});

// ── Existing smoke compatibility ───────────────────────────────────────────
['smoke:v113-9-4','smoke:v113-9-3','smoke:v113-9-2','smoke:v113-9-1'].forEach(function(s){
  t('existing: '+s,()=>{a(PKG.scripts[s])});
});

var total=p+f;console.log('');
if(f===0){console.log('✅ Fable 5 final resort policy smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ Fable 5 final resort policy smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
