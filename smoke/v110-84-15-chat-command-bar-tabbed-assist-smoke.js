#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'public', 'kosame-live-cockpit.html'), 'utf8');
const pkg = require('../package.json');
const { collectLiveCockpitSnapshot } = require('../tools/kosame-live-cockpit-snapshot');

const snap = collectLiveCockpitSnapshot();

assert.equal(pkg.version, '110.84.15', 'package.json version must be 110.84.15');
assert.equal(snap.currentVersion, '110.84.15', 'snapshot must expose the new current version');
assert.ok(String(snap.consoleContextSummary || '').includes('versionContext=package=110.84.15'), 'console context summary must include the package version');

assert.ok(html.includes('chat-primary-actions'), 'HTML must keep the main chat command bar class');
assert.ok(html.includes('chat-command-bar'), 'HTML must include the chat command bar');
assert.ok(html.includes('@media (max-width: 1199px)'), 'HTML must include the medium-width stack breakpoint');
assert.ok(html.includes('@media (max-width: 900px)'), 'HTML must include the narrow-width breakpoint');
assert.ok(html.includes('min-height: 184px'), 'HTML must keep the compact chat timeline height');
assert.ok(html.includes('max-height: 360px'), 'HTML must keep the compact chat timeline max height');
assert.ok(html.includes('じゅんやさん、ここで相談できます☂️'), 'HTML must include the empty chat timeline welcome bubble');
assert.ok(html.includes('現在地や次の一手は、必要な時だけ補助メニューから確認できます。'), 'HTML must include the empty chat timeline helper text');
assert.ok(html.includes("方針が決まったら、下の『この方針で進める』で進められます。"), 'HTML must include the empty chat timeline proceed hint');
assert.ok(html.includes('formatTokyoTimestamp'), 'HTML must use the Tokyo timestamp formatter');
assert.ok(html.includes("timeZone: 'Asia/Tokyo'"), 'HTML must format visible timestamps in Asia/Tokyo');
assert.ok(html.includes('この方針で進める'), 'HTML must include the new primary CTA text');
assert.ok(html.includes('chat-proceed'), 'HTML must include the primary proceed button id');
assert.ok(html.includes('chat-input'), 'HTML must include the chat input');
assert.ok(html.indexOf('chat-input') < html.indexOf('chat-proceed'), 'HTML must place the input before the proceed button');
assert.ok(!html.includes('>↗<'), 'HTML must not include a visible send icon button');
assert.ok(!html.includes('>送信<'), 'HTML must not include a visible send button');
assert.ok(html.includes('chat-summarize'), 'HTML must keep the confirmation summary button');
assert.ok(html.includes('chat-action-drawer'), 'HTML must keep the assist wrapper class');
assert.ok(html.includes('補助メニュー'), 'HTML must keep the collapsed assist drawer label');
assert.ok(html.includes('chat-sound-details-compact'), 'HTML must keep the compact sound UI');
assert.ok(html.includes('chat-quick-actions'), 'HTML must keep the assist tab row class');
assert.ok(html.includes('data-assist-tab="current"'), 'HTML must include the current tab');
assert.ok(html.includes('data-assist-tab="next"'), 'HTML must include the next tab');
assert.ok(html.includes('data-assist-tab="danger"'), 'HTML must include the danger tab');
assert.ok(html.includes('data-assist-tab="alternative"'), 'HTML must include the alternative tab');
assert.ok(html.includes('data-assist-tab="notifications"'), 'HTML must include the notifications tab');
assert.ok(html.includes('data-assist-tab="diagnostics"'), 'HTML must include the diagnostics tab');
assert.ok(html.includes('chat-assist-panel'), 'HTML must include the assist panel');
assert.ok(html.includes('chat-assist-content'), 'HTML must include the assist content area');
assert.ok(html.includes('renderChatAssistPanel'), 'HTML must include the tab render function');
assert.ok(html.includes('selectAssistTab'), 'HTML must include the tab selection function');
assert.ok(html.includes('この内容で進める'), 'HTML must keep the legacy proceed text for older checks');
assert.ok(html.includes('この案で進める'), 'HTML must keep the alternate legacy proceed text for older checks');
assert.ok(html.includes('現在は '), 'HTML must show the Japanese current-state summary');
assert.ok(html.includes('次は '), 'HTML must show the Japanese next-step summary');
assert.ok(html.includes('危険ゲートは '), 'HTML must show the Japanese danger summary');
assert.ok(html.includes('Enterで送信 / Shift+Enterで改行'), 'HTML must keep the compact send hint');
assert.ok(!html.includes('currentVersion:'), 'HTML must not show raw currentVersion key text');
assert.ok(!html.includes('packageVersion:'), 'HTML must not show raw packageVersion key text');
assert.ok(!html.includes('latestTag:'), 'HTML must not show raw latestTag key text');
assert.ok(!html.includes('headCommit:'), 'HTML must not show raw headCommit key text');
assert.ok(!html.includes('v110.84.2'), 'HTML must not include stale fixed v110.84.2 text');
assert.ok(!html.includes('<div class="chat-meta-row" aria-label="通知音設定">'), 'HTML must not keep notification controls on the chat surface');
assert.ok(!html.includes('<div class="chat-status-badges" id="chat-status-badges" aria-label="チャット状態">'), 'HTML must not keep AI/context/memory badges on the chat surface');
assert.ok(!html.includes('Project Registry 由来の選択式ストリップです。増えても崩れないように、今見たいプロジェクトだけを小さく並べています。'), 'HTML must not include the long project strip description');
assert.ok(!html.includes('選択中のプロジェクトだけを大きく見せて、git status / changed files / staged files / recent commits / Actions を読む場所としてまとめています。'), 'HTML must not include the long project focus description');
assert.ok(!html.includes('こさめに質問・相談ができます。Console の状態をコンテキストとして共有します。必要なときだけ、チャットへ移動してください。'), 'HTML must not include the long chat description');
assert.ok(!html.includes('AUTO SAVE / TASK VAULT / WISHLIST / IDEA BOARD / WARNINGS / 補助情報を、必要なときだけ開けるようにまとめています。'), 'HTML must not include the long collapsed details description');
assert.ok(html.includes('chat-callout'), 'HTML must keep the attention callout');
assert.ok(html.includes('chat-sound-details-compact'), 'HTML must keep the collapsed sound UI');
assert.ok(html.indexOf('chat-thread') < html.indexOf('chat-primary-actions'), 'HTML must place the chat timeline above the command bar');
assert.ok(html.includes("e.key === 'Enter' && !e.shiftKey"), 'HTML must keep Enter-to-send handling');
assert.ok(html.includes('Shift+Enterで改行'), 'HTML must keep the compact hint text');

assert.ok(snap.consoleContextSummary.includes('currentVersion=110.84.15'), 'console context summary must include currentVersion');
assert.ok(snap.consoleContextSummary.includes('taskFeeder='), 'console context summary must include task feeder data');
assert.ok(snap.consoleContextSummary.includes('wishlist='), 'console context summary must include wishlist data');

console.log('PASS');
