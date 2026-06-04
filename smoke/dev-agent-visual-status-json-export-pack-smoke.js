'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-visual-status-json-export-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-visual-status-json-export-pack smoke ===');

// package version >= 47
assert.ok(
  parseInt(pkg.version.split('.')[0], 10) >= 47,
  `pkg version must be >= 47.0.0, got ${pkg.version}`
);
console.log('  PASS: package version 47.0.0 or later');

// smoke script exists
assert.ok(pkg.scripts['smoke:visual-status-json-export'], 'smoke:visual-status-json-export script must exist');
console.log('  PASS: smoke script exists');

// fixture exists
assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-visual-status-json-export-pack.fixture.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

// tool meta version
assert.strictEqual(tool.TOOL_META.version, '47.0.0', 'tool version must be 47.0.0');
console.log('  PASS: tool meta version 47.0.0');

// build JSON
const json = tool.buildVisualStatusJSON({
  product: 'ANESTY Board',
  task:    'v87.0.9 docs/runbook controlled task',
  repo:    '/home/shimohigoshi/anesty-board',
  commit:  '302f692'
});

// parseable
let reparsed;
try {
  reparsed = JSON.parse(JSON.stringify(json));
} catch (e) {
  assert.fail('JSON output must be parseable: ' + e.message);
}
console.log('  PASS: JSON output is parseable');

// schemaVersion exists
assert.ok(reparsed.schemaVersion, 'schemaVersion must exist');
console.log('  PASS: schemaVersion exists');

// orchestraVersion 47.0.0
assert.strictEqual(reparsed.orchestraVersion, '47.0.0', 'orchestraVersion must be 47.0.0');
console.log('  PASS: orchestraVersion 47.0.0');

// stages[] exists and non-empty
assert.ok(Array.isArray(reparsed.stages) && reparsed.stages.length > 0, 'stages[] must exist and be non-empty');
console.log('  PASS: stages[] exists');

// agents[] exists and non-empty
assert.ok(Array.isArray(reparsed.agents) && reparsed.agents.length > 0, 'agents[] must exist and be non-empty');
console.log('  PASS: agents[] exists');

// dangerGates[] exists and non-empty
assert.ok(Array.isArray(reparsed.dangerGates) && reparsed.dangerGates.length > 0, 'dangerGates[] must exist and be non-empty');
console.log('  PASS: dangerGates[] exists');

// acceptance exists
assert.ok(reparsed.acceptance && typeof reparsed.acceptance === 'object', 'acceptance must exist');
console.log('  PASS: acceptance exists');

// nextAction exists
assert.ok(reparsed.nextAction, 'nextAction must exist');
console.log('  PASS: nextAction exists');

// dryRun true
assert.strictEqual(reparsed.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

// humanApprovalRequired true
assert.strictEqual(reparsed.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// dangerousActionsDenied correct
const denied = reparsed.dangerousActionsDenied;
assert.ok(Array.isArray(denied) && denied.length >= 4, 'dangerousActionsDenied must have 4+ items');
assert.ok(denied.some(d => d.includes('deploy')),       'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')),  'dangerousActionsDenied must include secret read');
assert.ok(denied.some(d => d.includes('.env read')),    'dangerousActionsDenied must include .env read');
assert.ok(denied.some(d => d.includes('git push')),     'dangerousActionsDenied must include git push');
console.log('  PASS: dangerousActionsDenied correct');

// Discord/Webhook not sent
assert.strictEqual(reparsed.discordWebhookSent,  false, 'discordWebhookSent must be false');
assert.strictEqual(reparsed.externalRequestSent, false, 'externalRequestSent must be false');
console.log('  PASS: Discord/Webhook送信なし (discordWebhookSent=false, externalRequestSent=false)');

// required agent names present
const agentNames = reparsed.agents.map(a => a.name);
assert.ok(agentNames.some(n => n.includes('KOSAME')),         'KOSAME agent must be present');
assert.ok(agentNames.some(n => n.includes('Claude')),         'Claude agent must be present');
assert.ok(agentNames.some(n => n.includes('Gemini')),         'Gemini agent must be present');
assert.ok(agentNames.some(n => n.includes('GitHub Actions')), 'GitHub Actions agent must be present');
assert.ok(agentNames.some(n => n.includes('Human')),          'Human agent must be present');
console.log('  PASS: agents include KOSAME/Claude/Gemini/GitHub Actions/Human');

// all danger gates BLOCKED
assert.ok(reparsed.dangerGates.every(g => g.status === 'BLOCKED'), 'all danger gates must be BLOCKED');
console.log('  PASS: all danger gates BLOCKED');

// generatedAt and product/task/repo/commit
assert.ok(reparsed.generatedAt, 'generatedAt must exist');
assert.ok(reparsed.product,     'product must exist');
assert.ok(reparsed.task,        'task must exist');
assert.ok(reparsed.repo,        'repo must exist');
assert.ok(reparsed.commit,      'commit must exist');
console.log('  PASS: generatedAt/product/task/repo/commit all present');

// DEFAULT_* exports
assert.ok(Array.isArray(tool.DEFAULT_STAGES),      'DEFAULT_STAGES must be exported');
assert.ok(Array.isArray(tool.DEFAULT_AGENTS),      'DEFAULT_AGENTS must be exported');
assert.ok(Array.isArray(tool.DEFAULT_DANGER_GATES), 'DEFAULT_DANGER_GATES must be exported');
console.log('  PASS: DEFAULT_STAGES/AGENTS/DANGER_GATES exported');

console.log('=== dev-agent-visual-status-json-export-pack smoke PASSED ===');
