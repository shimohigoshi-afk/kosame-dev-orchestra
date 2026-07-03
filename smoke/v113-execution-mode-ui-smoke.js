#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')),MIN_VERSION='113.9.4';
let p=0,f=0;function t(n,fn){try{fn();console.log('  PASS: '+n);p++}catch(e){console.error('  FAIL: '+n+' — '+e.message);f++}}function a(c,m){if(!c)throw new Error(m||'assertion failed')}function rd(r){return fs.readFileSync(path.join(ROOT,r),'utf8')}

console.log('===== v'+MIN_VERSION+' execution-mode UI smoke =====');
t('version >= '+MIN_VERSION,()=>{const pa=PKG.version.split('.').map(Number),pb=MIN_VERSION.split('.').map(Number);a(pa[0]*10000+pa[1]*100+pa[2]>=pb[0]*10000+pb[1]*100+pb[2])});

var html=rd('public/kosame-live-cockpit.html');

// ── 実行モードUIが存在する ─────────────────────────────────────────────────
t('dom: chat-mode-row',()=>{a(html.includes('id="chat-mode-row"'))});
t('dom: mode-complete pill',()=>{a(html.includes('mode-complete'))});
t('dom: mode-safe pill',()=>{a(html.includes('mode-safe'))});
t('dom: mode-boost pill',()=>{a(html.includes('mode-boost'))});
t('dom: mode-verify pill',()=>{a(html.includes('mode-verify'))});
t('dom: mode-fable pill',()=>{a(html.includes('mode-fable'))});

// ── 各モードの文言 ────────────────────────────────────────────────────────
t('label: 完走モード',()=>{a(html.includes('完走モード'))});
t('label: セーフモード',()=>{a(html.includes('セーフモード'))});
t('label: ブーストモード',()=>{a(html.includes('ブーストモード'))});
t('label: 検証モード',()=>{a(html.includes('検証モード'))});
t('label: Fableモード',()=>{a(html.includes('Fableモード'))});

// ── Fableモード: final_resort_lane / 最終兵器 / 常用禁止 ─────────────────────
t('fable: final_resort_lane',()=>{a(html.includes('final_resort_lane'))});
t('fable: 最終兵器',()=>{a(html.includes('最終兵器'))});
t('fable: 常用禁止',()=>{a(html.includes('常用禁止'))});

// ── Fableモード確認ダイアログ ─────────────────────────────────────────────
t('dom: chat-fable-dialog',()=>{a(html.includes('id="chat-fable-dialog"'))});
t('dom: chat-fable-reason',()=>{a(html.includes('id="chat-fable-reason"'))});
t('dom: chat-fable-confirm',()=>{a(html.includes('id="chat-fable-confirm"'))});
t('dom: chat-fable-cancel',()=>{a(html.includes('id="chat-fable-cancel"'))});
t('fable: reason input required',()=>{a(html.includes('投入理由（必須）')||html.includes('投入理由を入力'))});
t('fable: _showFableDialog',()=>{a(html.includes('function _showFableDialog'))});
t('fable: _hideFableDialog',()=>{a(html.includes('function _hideFableDialog'))});
t('fable: _confirmFableMode',()=>{a(html.includes('function _confirmFableMode'))});
t('fable: confirm disabled by default',()=>{a(html.includes('chat-fable-confirm" disabled')||html.includes(" 'disabled'")||html.includes('confirmBtn.disabled'))});
t('fable: dialog hidden by default',()=>{a(html.includes('chat-fable-dialog" hidden')||html.includes("setAttribute('hidden'")||html.includes('.setAttribute(\'hidden\')')||html.includes('.setAttribute("hidden")'))});

// ── localStorage: executionMode保存処理 ───────────────────────────────────
t('storage: kosame.executionMode key',()=>{a(html.includes('kosame.executionMode'))});
t('storage: getChatMode exists',()=>{a(html.includes('function getChatMode'))});
t('storage: setChatMode exists',()=>{a(html.includes('function setChatMode'))});
t('storage: localStorage.getItem',()=>{a(html.includes('localStorage.getItem'))});
t('storage: localStorage.setItem',()=>{a(html.includes('localStorage.setItem'))});

// ── executionMode payload追加処理 ─────────────────────────────────────────
t('dispatch: executionMode in buildChatPayload',()=>{a(html.includes('executionMode: getChatMode()'))});
t('dispatch: executionMode appears >= 3 times (payload + build + dispatch)',()=>{
  var cnt=(html.match(/executionMode:/g)||[]).length;
  a(cnt>=3,'executionMode appears '+cnt+' times, expected >=3');
});

// ── 補助メニューがKOSAME CHAT近くへ移動されている ───────────────────────────
t('assist-menu: inside chat-outer',()=>{
  // Verify the assist-menu-strip appears between chat-panel closing and chat-outer closing
  var chatOuterIdx=html.indexOf('class="chat-outer"');
  var assistIdx=html.indexOf('id="assist-menu-strip"');
  var chatOuterCloseIdx=html.indexOf('</section>',assistIdx);
  var supportIdx=html.indexOf('class="support-details-outer"');
  a(assistIdx>chatOuterIdx&&assistIdx<supportIdx,'assist-menu-strip is inside chat-outer, before support-details-outer');
});
t('assist-menu: 4 tabs only',()=>{
  // Count data-assist-tab attributes in the assist-menu-strip section
  var sectionMatch=html.match(/id="assist-menu-strip"[\s\S]*?<section class="support-details-outer"/);
  if(!sectionMatch)sectionMatch=html.match(/id="assist-menu-strip"[\s\S]*?id="support-details/);
  var assistSection=sectionMatch?sectionMatch[0]:html;
  var tabMatches=assistSection.match(/data-assist-tab="/g)||[];
  a(tabMatches.length===4,'assist-menu has '+tabMatches.length+' tabs, expected 4');
});

// ── 設定タブに通知音/デフォルト実行モード/Fable 5説明がある ──────────────────
t('settings: 通知音 info',()=>{a(html.includes('通知音:'))});
t('settings: デフォルト実行モード info',()=>{a(html.includes('デフォルト実行モード'))});
t('settings: Fable 5投入条件',()=>{a(html.includes('Fable 5投入条件'))});
t('settings: 設定項目は今後追加予定',()=>{a(html.includes('設定項目は今後追加予定です。'))});

// ── chat-send / submitChatFromInput / emergency guard を壊していない ─────
t('dom: chat-send preserved',()=>{a(html.includes('id="chat-send"'))});
t('JS: submitChatFromInput preserved',()=>{a(html.includes('function submitChatFromInput'))});
t('JS: submitPrioritizedChatInput preserved',()=>{a(html.includes('function submitPrioritizedChatInput'))});
t('JS: EXEC_TRIGGER_RE preserved',()=>{a(html.includes('EXEC_TRIGGER_RE'))});
t('JS: PROCEED_TRIGGER_RE preserved',()=>{a(html.includes('PROCEED_TRIGGER_RE'))});
t('JS: chatEnter key handler preserved',()=>{a(html.includes("key === 'Enter'"))});
t('JS: _zeroConfirmDispatch preserved',()=>{a(html.includes('function _zeroConfirmDispatch'))});
t('dom: chat-proceed preserved',()=>{a(html.includes('id="chat-proceed"'))});
t('dom: chat-input preserved',()=>{a(html.includes('id="chat-input"'))});

// ── console error要因になるtop-level return残骸がない ──────────────────────
t('JS: no top-level return',()=>{
  var lines=html.split('\n');
  var inBlock=0;
  for(var i=0;i<lines.length;i++){
    var line=lines[i].trim();
    if(line.startsWith('//')||line.startsWith('/*')||line.startsWith('*/')||line.startsWith('*'))continue;
    if(/\bfunction\b/.test(line)||/(?:if|for|while|switch|try|catch)\s*\(/.test(line)||/\{\s*$/.test(line))inBlock++;
    if(/^\s*\}\s*$/.test(line)||/^\s*\}\);\s*$/.test(line)||line==='}'||line==='});'){
      if(inBlock>0)inBlock--;
      else if(/^\s*return\b/.test(line))continue;
    }
    if(!inBlock&&/^\s*return\b/.test(line)&&!/function|if|catch/.test(line)){
      a(false,'top-level return found at line '+(i+1)+': '+line);
    }
  }
  a(true);
});

// ── fable: reason saved to localStorage ────────────────────────────────────
t('fable: kosame.fableLastReason storage',()=>{a(html.includes("kosame.fableLastReason"))});

// ── Package ────────────────────────────────────────────────────────────────
t('pkg: smoke:v113-execution-mode-ui',()=>{a(PKG.scripts['smoke:v113-execution-mode-ui'])});

var total=p+f;console.log('');
if(f===0){console.log('✅ v'+MIN_VERSION+' execution-mode UI smoke PASSED ('+p+'/'+total+')')}
else{console.error('❌ v'+MIN_VERSION+' execution-mode UI smoke FAILED ('+p+'/'+total+', '+f+' failures)');process.exit(1)}
