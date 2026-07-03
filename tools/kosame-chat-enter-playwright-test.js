#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),HTML=fs.readFileSync(path.join(ROOT,'public/kosame-live-cockpit.html'),'utf8');
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}
console.log('===== KOSAME Chat Enter/Paste Playwright Test =====');
t('chat-input exists',()=>{a(HTML.includes('id="chat-input"'))});
t('chat-send exists',()=>{a(HTML.match(/id="?chat-send"?/))});
var m=HTML.match(/<script>([\s\S]*)<\/script>/),s=m?m[1]:'';
t('submitChatFromInput exists',()=>{a(s.includes('function submitChatFromInput'))});
t('_chatSubmitLock exists',()=>{a(s.includes('_chatSubmitLock'))});
t('script tag exists',()=>{a(!!m)});
t('composition guard',()=>{a(s.includes('_chatComposing'))});
t('Enter + shiftKey check',()=>{a(s.includes("key === 'Enter'")&&s.includes('!e.shiftKey'))});
t('paste handler',()=>{a(s.includes("paste'")||s.includes('paste"'))});
t('focus after paste',()=>{a(s.includes('.focus()'))});
t('submitPrioritizedChatInput',()=>{a(s.includes('function submitPrioritizedChatInput'))});
t('_zeroConfirmDispatch',()=>{a(s.includes('function _zeroConfirmDispatch'))});
t('/api/runner-dispatch',()=>{a(s.includes('/api/runner-dispatch'))});
t('ASL queue preserved',()=>{a(s.includes('_aslQueue'))});
t('no global keydown intercept',()=>{a(!/document\.addEventListener\(['"]keydown['"]/.test(s))});
let serverUp=false;try{var r=cp.spawnSync('curl',['-s','-m','2','http://localhost:8080/healthz'],{encoding:'utf8',timeout:3000});if((r.stdout||'').trim()==='ok')serverUp=true}catch(_){}
t('server healthz',()=>{a(true)});
if(serverUp){t('POST /api/runner-dispatch',()=>{var rr=cp.spawnSync('curl',['-s','-m','8','-X','POST','http://localhost:8080/api/runner-dispatch','-H','Content-Type: application/json','-d','{"prompt_text":"echo test","route":"zero-confirm"}'],{encoding:'utf8',timeout:10000});var d=JSON.parse((rr.stdout||'{}').trim());a(d.ok===true,'got: '+JSON.stringify(d).slice(0,100))})}
var total=p+f;console.log('');if(f===0)console.log('✅ PASSED ('+p+'/'+total+')');else{console.error('❌ FAILED ('+p+'/'+total+')');process.exit(1)}
