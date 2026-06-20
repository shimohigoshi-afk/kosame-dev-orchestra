#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const pkg = require('../package.json');
const { detectSafetyStop, classifySafetyStop, summarizeSafetyStop } = require('../tools/kosame-safety-stop-detector');

console.log('=== v113.3.0 safety detector smoke ===');
assert.ok(pkg.scripts['smoke:v113-3-0:safety'], 'package wiring');

const secret = detectSafetyStop('API_KEY=abc123 SECRET token password');
assert.equal(secret.matched, true);
assert.ok(secret.categories.includes('secret'));
assert.ok(secret.categories.includes('api_key'));

const deploy = classifySafetyStop('git push --force && gcloud run deploy');
assert.equal(deploy.shouldBlock, true);
assert.ok(deploy.categories.includes('force_push'));
assert.ok(deploy.categories.includes('production_deploy') || deploy.categories.includes('billing') || deploy.categories.includes('force_push'));

const safe = summarizeSafetyStop(detectSafetyStop('通常の作業票を作成するだけです'));
assert.equal(safe.matched, false);
assert.equal(safe.shouldBlock, false);

console.log('✅ v113.3.0 safety detector smoke PASSED');
