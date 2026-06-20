#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const ROOT = path.resolve(__dirname, '..');
const { isVersionAtLeast } = require('./version-compare');

const SNAPSHOT_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-snapshot.js');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');

const EXPECTED_IDS = ['codex', 'claude', 'gemini', 'grok', 'deepseek', 'llama'];
const VALID_STATUSES = ['running', 'idle', 'missing'];
const VALID_TIERS = ['A', 'B', 'C'];

async function main() {
  console.log('=== v113.0.7 AI Roster smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.0.7'), `version must be >= 113.0.7 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-0-7'], 'smoke:v113-0-7 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-0-7'), 'verify must include smoke:v113-0-7');
  console.log('  PASS: package wiring');

  // Snapshot module exports buildAiRoster
  delete require.cache[require.resolve(SNAPSHOT_PATH)];
  const snapshotMod = require(SNAPSHOT_PATH);
  assert.ok(typeof snapshotMod.buildAiRoster === 'function', 'snapshot must export buildAiRoster');
  console.log('  PASS: buildAiRoster exported');

  // buildAiRoster returns 6 entries with required shape
  const mockProvider = {
    geminiKeyPresent: true,
    deepseekKeyPresent: false,
    llamaKeyPresent: false,
  };
  const mockCw = { running: true, pid: 9999 };
  const mockHandoff = { title: 'UIテスト作業' };

  const roster = snapshotMod.buildAiRoster(mockProvider, mockCw, mockHandoff);
  assert.ok(Array.isArray(roster), 'buildAiRoster must return an array');
  assert.equal(roster.length, 6, 'roster must have 6 entries');
  console.log('  PASS: roster has 6 entries');

  for (const ai of roster) {
    assert.ok(EXPECTED_IDS.includes(ai.id), `unexpected id: ${ai.id}`);
    assert.ok(typeof ai.name === 'string' && ai.name.length > 0, `ai.name must be non-empty for ${ai.id}`);
    assert.ok(VALID_STATUSES.includes(ai.status), `invalid status "${ai.status}" for ${ai.id}`);
    assert.ok(typeof ai.task === 'string' && ai.task.length > 0, `ai.task must be non-empty for ${ai.id}`);
    assert.ok(VALID_TIERS.includes(ai.tier), `invalid tier "${ai.tier}" for ${ai.id}`);
  }
  console.log('  PASS: all roster entries have valid shape');

  // Tier assignments
  const byId = Object.fromEntries(roster.map(a => [a.id, a]));
  assert.equal(byId.codex.tier, 'A', 'Codex must be Tier A');
  assert.equal(byId.claude.tier, 'A', 'Claude must be Tier A');
  assert.equal(byId.gemini.tier, 'B', 'Gemini must be Tier B');
  assert.equal(byId.deepseek.tier, 'B', 'DeepSeek must be Tier B');
  assert.equal(byId.grok.tier, 'C', 'Grok must be Tier C');
  assert.equal(byId.llama.tier, 'C', 'Llama must be Tier C');
  console.log('  PASS: tier assignments correct');

  // Codex running when codexWatch.running=true
  assert.equal(byId.codex.status, 'running', 'Codex must be running when codexWatch.running=true');
  assert.ok(byId.codex.task.includes('UIテスト作業'), 'Codex task must include handoff title');
  assert.equal(byId.claude.status, 'running', 'Claude must always be running');

  // Gemini present when key is set
  assert.equal(byId.gemini.status, 'idle', 'Gemini must be idle when key present');
  assert.equal(byId.deepseek.status, 'missing', 'DeepSeek must be missing when key absent');
  console.log('  PASS: provider-based status derivation correct');

  // collectLiveCockpitSnapshot includes aiRoster
  const snap = snapshotMod.collectLiveCockpitSnapshot();
  assert.ok(Array.isArray(snap.aiRoster), 'snapshot.aiRoster must be an array');
  assert.equal(snap.aiRoster.length, 6, 'snapshot.aiRoster must have 6 entries');
  console.log('  PASS: collectLiveCockpitSnapshot includes aiRoster');

  // HTML checks
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.ok(html.includes('id="ai-roster"'), 'HTML must have ai-roster element');
  assert.ok(html.includes('AI ROSTER'), 'HTML must have AI ROSTER heading');
  assert.ok(html.includes('renderAiRoster'), 'HTML must define renderAiRoster');
  assert.ok(html.includes('ai-roster-item'), 'HTML must have .ai-roster-item CSS class');
  assert.ok(html.includes('ai-roster-tier'), 'HTML must have .ai-roster-tier CSS class');
  assert.ok(html.includes('tier-a'), 'HTML must have tier-a CSS class');
  console.log('  PASS: HTML structure');

  console.log('✅ v113.0.7 AI Roster smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
