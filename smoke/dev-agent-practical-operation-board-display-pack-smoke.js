'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-practical-operation-board-display-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-practical-operation-board-display-pack smoke ===');

// package version >= 48
assert.ok(
  parseInt(pkg.version.split('.')[0], 10) >= 48,
  `pkg version must be >= 48.0.0, got ${pkg.version}`
);
console.log('  PASS: package version 48.0.0 or later');

// smoke script exists
assert.ok(pkg.scripts['smoke:practical-operation-board-display'], 'smoke:practical-operation-board-display must exist');
console.log('  PASS: smoke script exists');

// pm-agent script exists
assert.ok(pkg.scripts['pm-agent:show-operation-board'], 'pm-agent:show-operation-board must exist');
console.log('  PASS: npm script exists: pm-agent:show-operation-board');

// fixture exists
assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-practical-operation-board-display-pack.fixture.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

// tool meta version
assert.strictEqual(tool.TOOL_META.version, '48.0.0', 'tool version must be 48.0.0');
console.log('  PASS: tool meta version 48.0.0');

// buildDefaultPacket with no args — must not throw
let packet;
assert.doesNotThrow(() => { packet = tool.buildDefaultPacket(); }, 'buildDefaultPacket() must not throw without arguments');
console.log('  PASS: render/display function can run without packet (no throw)');

// dryRun true
assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

// humanApprovalRequired true
assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// default packet fills product/task/repo/version with non-dash values
assert.ok(packet.target.product && packet.target.product !== '-', 'product must not be "-"');
assert.ok(packet.target.task    && packet.target.task    !== '-', 'task must not be "-"');
assert.ok(packet.target.repo    && packet.target.repo    !== '-', 'repo must not be "-"');
assert.ok(packet.target.version && packet.target.version !== '-', 'version must not be "-"');
console.log('  PASS: default packet fills product/task/repo/version');

// version is 48.0.0
assert.strictEqual(packet.version, '48.0.0', 'packet version must be 48.0.0');
assert.strictEqual(packet.target.version, '48.0.0', 'target version must be 48.0.0');
console.log('  PASS: v48.0.0 として表示できる');

// boardText contains required sections
const board = packet.boardText;
assert.ok(typeof board === 'string' && board.length > 100, 'boardText must be a non-trivial string');
assert.ok(board.includes('TARGET'),       'boardText must contain TARGET');
assert.ok(board.includes('STAGE'),        'boardText must contain STAGE');
assert.ok(board.includes('AGENTS'),       'boardText must contain AGENTS');
assert.ok(board.includes('DANGER GATES'), 'boardText must contain DANGER GATES');
assert.ok(board.includes('NEXT ACTION'),  'boardText must contain NEXT ACTION');
assert.ok(board.includes('ACCEPTANCE'),   'boardText must contain ACCEPTANCE');
console.log('  PASS: board contains TARGET/STAGE/AGENTS/DANGER GATES/NEXT ACTION/ACCEPTANCE');

// danger gates
const gateNames = packet.dangerGates.map(g => g.name);
assert.ok(gateNames.some(n => n.toLowerCase().includes('secret')),        'Secret gate must exist');
assert.ok(gateNames.some(n => n.toLowerCase().includes('.env')),          '.env gate must exist');
assert.ok(gateNames.some(n => n.toLowerCase().includes('deploy')),        'deploy gate must exist');
assert.ok(gateNames.some(n => n.toLowerCase().includes('git push')),      'git push gate must exist');
assert.ok(gateNames.some(n => n.toLowerCase().includes('customer data')), 'customer data gate must exist');
assert.ok(gateNames.some(n => n.toLowerCase().includes('destructive')),   'destructive gate must exist');
console.log('  PASS: danger gates include Secret/.env/deploy/git push/customer data/destructive delete');

// all danger gates BLOCKED
assert.ok(packet.dangerGates.every(g => g.status === 'BLOCKED'), 'all danger gates must be BLOCKED');
console.log('  PASS: all danger gates BLOCKED');

// dangerousActionsDenied correct
const denied = packet.dangerousActionsDenied;
assert.ok(Array.isArray(denied) && denied.length >= 4, 'dangerousActionsDenied must have 4+ items');
assert.ok(denied.some(d => d.includes('deploy')),      'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
assert.ok(denied.some(d => d.includes('.env read')),   'dangerousActionsDenied must include .env read');
assert.ok(denied.some(d => d.includes('git push')),    'dangerousActionsDenied must include git push');
console.log('  PASS: dangerousActionsDenied correct');

// DEFAULT_DISPLAY_OPTS exported
assert.ok(tool.DEFAULT_DISPLAY_OPTS && tool.DEFAULT_DISPLAY_OPTS.product, 'DEFAULT_DISPLAY_OPTS must be exported');
console.log('  PASS: DEFAULT_DISPLAY_OPTS exported');

// displayBoard exported
assert.ok(typeof tool.displayBoard === 'function', 'displayBoard must be exported');
console.log('  PASS: displayBoard exported');

console.log('=== dev-agent-practical-operation-board-display-pack smoke PASSED ===');
