#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const MANIFEST_PATH = path.join(ROOT, 'public', 'manifest.webmanifest');
const ICON_PATH = path.join(ROOT, 'public', 'kosame-icon.svg');
const SW_PATH = path.join(ROOT, 'public', 'kosame-sw.js');

function mustExist(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} must exist`);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function include(text, needle, label) {
  assert.ok(text.includes(needle), `${label} must include "${needle}"`);
}

console.log('=== v110.84.5 console pwa notification smoke ===');

assert.ok(isVersionAtLeast(pkg.version, '110.84.5'), `package version must be >= 110.84.5 (got ${pkg.version})`);
assert.ok(pkg.scripts['smoke:v110-84-5'], 'smoke:v110-84-5 must exist in scripts');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-5'), 'verify must include smoke:v110-84-5');
console.log('  PASS: package wiring for v110.84.5');

mustExist(HTML_PATH);
mustExist(MANIFEST_PATH);
mustExist(ICON_PATH);
mustExist(SW_PATH);
console.log('  PASS: required files exist');

const html = readText(HTML_PATH);

include(html, 'rel="manifest"', 'HTML');
include(html, 'apple-mobile-web-app-capable', 'HTML');
include(html, 'apple-mobile-web-app-status-bar-style', 'HTML');
include(html, 'theme-color', 'HTML');
include(html, 'viewport-fit=cover', 'HTML');
console.log('  PASS: HTML contains PWA meta tags');

include(html, 'sound-mode-row', 'HTML');
include(html, 'sound-btn-${spec.mode}', 'HTML');
include(html, 'notificationMode', 'HTML');
include(html, 'NOTIFICATION_MODE_KEY', 'HTML');
include(html, 'setNotificationMode', 'HTML');
include(html, 'readNotificationMode', 'HTML');
console.log('  PASS: HTML contains 3-mode notification selector');

include(html, 'こさめ質問音', 'HTML');
include(html, 'HUMAN_GATE音', 'HTML');
include(html, 'DONE音', 'HTML');
include(html, 'ERROR音', 'HTML');
include(html, 'playSoundTypeTest', 'HTML');
console.log('  PASS: HTML contains sound type test buttons');

include(html, 'playClearChimeCtx', 'HTML');
include(html, 'playSoftChimeCtx', 'HTML');
include(html, 'playClearTypeSoundCtx', 'HTML');
include(html, '1109', 'HTML');
console.log('  PASS: HTML contains Clear mode chime implementation');

include(html, 'sound-toggle', 'HTML');
include(html, 'sound-test', 'HTML');
include(html, 'playNotificationChime', 'HTML');
include(html, 'playNotificationTone', 'HTML');
console.log('  PASS: backward compat IDs and functions remain');

include(html, 'safe-area-inset-bottom', 'HTML');
include(html, 'overflow-x: auto', 'HTML');
include(html, 'chat-sound-type-row', 'HTML');
include(html, 'serviceWorker', 'HTML');
console.log('  PASS: HTML contains smartphone CSS and SW registration');

assert.ok(!html.match(/OPENAI_API_KEY\s*[=:]/), 'HTML must not contain API key assignment');
assert.ok(html.includes('process.env.OPENAI_API_KEY') || !html.includes('OPENAI_API_KEY'), 'HTML must not expose API key literal');
console.log('  PASS: HTML does not expose API key');

const manifest = JSON.parse(readText(MANIFEST_PATH));
assert.ok(manifest.name, 'manifest must have name');
assert.ok(manifest.short_name, 'manifest must have short_name');
assert.ok(manifest.start_url, 'manifest must have start_url');
assert.ok(manifest.display, 'manifest must have display');
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest must have icons');
assert.equal(manifest.background_color, '#07111f', 'manifest background must match KOSAME theme');
console.log('  PASS: manifest.webmanifest is valid');

const svg = readText(ICON_PATH);
include(svg, '<svg', 'kosame-icon.svg');
include(svg, 'viewBox', 'kosame-icon.svg');
console.log('  PASS: kosame-icon.svg is valid SVG');

const sw = readText(SW_PATH);
include(sw, 'fetch', 'kosame-sw.js');
include(sw, 'cache', 'kosame-sw.js');
include(sw, 'install', 'kosame-sw.js');
include(sw, 'activate', 'kosame-sw.js');
assert.ok(!sw.includes('OPENAI_API_KEY'), 'SW must not contain API key');
console.log('  PASS: kosame-sw.js is a valid network-first service worker');

console.log('✅ v110.84.5 console pwa notification smoke PASSED');
