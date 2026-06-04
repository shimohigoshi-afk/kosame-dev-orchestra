'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-cli-operation-board-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-cli-operation-board-pack smoke ===');

// package version >= 45
assert.ok(
  parseInt(pkg.version.split('.')[0], 10) >= 45,
  `pkg version must be >= 45.0.0, got ${pkg.version}`
);
console.log('  PASS: package version 45.0.0 or later');

// smoke script exists
assert.ok(pkg.scripts['smoke:cli-operation-board'], 'smoke:cli-operation-board script must exist');
console.log('  PASS: smoke script exists');

// pm-agent script exists
assert.ok(pkg.scripts['pm-agent:cli-operation-board'], 'pm-agent:cli-operation-board script must exist');
console.log('  PASS: pm-agent script exists');

// fixture exists
assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-cli-operation-board-pack.fixture.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

// tool meta version
assert.strictEqual(tool.TOOL_META.version, '45.0.0', 'tool version must be 45.0.0');
console.log('  PASS: tool meta version 45.0.0');

// build packet with defaults
const packet = tool.buildOperationBoard({
  product: 'ANESTY Board',
  task:    'v87.0.9 docs/runbook controlled task',
  repo:    '/home/shimohigoshi/anesty-board',
  version: '45.0.0',
  commit:  '302f692'
});

// dryRun true
assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

// humanApprovalRequired true
assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// boardText contains required sections
const board = packet.boardText;
assert.ok(typeof board === 'string' && board.length > 100, 'boardText must be a non-trivial string');
assert.ok(board.includes('TARGET'),       'boardText must contain TARGET');
assert.ok(board.includes('STAGE'),        'boardText must contain STAGE');
assert.ok(board.includes('AGENTS'),       'boardText must contain AGENTS');
assert.ok(board.includes('DANGER GATES'), 'boardText must contain DANGER GATES');
assert.ok(board.includes('NEXT ACTION'),  'boardText must contain NEXT ACTION');
assert.ok(board.includes('ACCEPTANCE'),   'boardText must contain ACCEPTANCE');
console.log('  PASS: boardText contains TARGET/STAGE/AGENTS/DANGER GATES/NEXT ACTION/ACCEPTANCE');

// danger gates include required items
const gateNames = packet.dangerGates.map(g => g.name);
assert.ok(gateNames.some(n => n.toLowerCase().includes('secret')),         'Secret gate must be present');
assert.ok(gateNames.some(n => n.toLowerCase().includes('.env')),           '.env gate must be present');
assert.ok(gateNames.some(n => n.toLowerCase().includes('deploy')),         'deploy gate must be present');
assert.ok(gateNames.some(n => n.toLowerCase().includes('git push')),       'git push gate must be present');
assert.ok(gateNames.some(n => n.toLowerCase().includes('customer data')),  'customer data gate must be present');
assert.ok(gateNames.some(n => n.toLowerCase().includes('destructive')),    'destructive delete gate must be present');
console.log('  PASS: danger gates include Secret/.env/deploy/git push/customer data/destructive delete');

// all danger gates BLOCKED
assert.ok(packet.dangerGates.every(g => g.status === 'BLOCKED'), 'all danger gates must be BLOCKED');
console.log('  PASS: all danger gates BLOCKED');

// agent statuses include required agents
const agentNames = packet.agents.map(a => a.name);
assert.ok(agentNames.some(n => n.includes('KOSAME')),         'KOSAME agent must be present');
assert.ok(agentNames.some(n => n.includes('Claude')),         'Claude agent must be present');
assert.ok(agentNames.some(n => n.includes('Gemini')),         'Gemini agent must be present');
assert.ok(agentNames.some(n => n.includes('GitHub Actions')), 'GitHub Actions agent must be present');
assert.ok(agentNames.some(n => n.includes('Human')),          'Human agent must be present');
console.log('  PASS: agents include KOSAME/Claude/Gemini/GitHub Actions/Human');

// dangerousActionsDenied correct
const denied = packet.dangerousActionsDenied;
assert.ok(Array.isArray(denied) && denied.length >= 4, 'dangerousActionsDenied must have 4+ items');
assert.ok(denied.some(d => d.includes('deploy')),       'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')),  'dangerousActionsDenied must include secret read');
assert.ok(denied.some(d => d.includes('.env read')),    'dangerousActionsDenied must include .env read');
assert.ok(denied.some(d => d.includes('git push')),     'dangerousActionsDenied must include git push');
console.log('  PASS: dangerousActionsDenied correct');

// blockers → acceptance stops (commitCandidate = false)
const packetBlocked = tool.buildOperationBoard({
  blockers: ['verify failed', 'bot.js touched']
});
assert.strictEqual(packetBlocked.acceptance.commitCandidate, false, 'commitCandidate must be false when blockers exist');
assert.ok(packetBlocked.acceptance.blockers.length > 0, 'blockers must be populated');
console.log('  PASS: blockers present → commitCandidate false');

// no blockers → commitCandidate true
const packetClean = tool.buildOperationBoard({ blockers: [] });
assert.strictEqual(packetClean.acceptance.commitCandidate, true, 'commitCandidate must be true when no blockers');
console.log('  PASS: no blockers → commitCandidate true');

// renderBoard export
assert.ok(typeof tool.renderBoard === 'function', 'renderBoard must be exported');
const rendered = tool.renderBoard(packet);
assert.ok(typeof rendered === 'string' && rendered.length > 50, 'renderBoard must return a string');
console.log('  PASS: renderBoard exported and callable');

// DEFAULT_* exports
assert.ok(Array.isArray(tool.DEFAULT_STAGES)     && tool.DEFAULT_STAGES.length     >= 8, 'DEFAULT_STAGES must have 8+ items');
assert.ok(Array.isArray(tool.DEFAULT_AGENTS)     && tool.DEFAULT_AGENTS.length     >= 6, 'DEFAULT_AGENTS must have 6+ items');
assert.ok(Array.isArray(tool.DEFAULT_DANGER_GATES) && tool.DEFAULT_DANGER_GATES.length >= 6, 'DEFAULT_DANGER_GATES must have 6+ items');
console.log('  PASS: DEFAULT_STAGES/AGENTS/DANGER_GATES exported');

console.log('=== dev-agent-cli-operation-board-pack smoke PASSED ===');
