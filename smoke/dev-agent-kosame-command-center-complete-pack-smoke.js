'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-kosame-command-center-complete-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-kosame-command-center-complete-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 80, `pkg version must be >= 80.0.0, got ${pkg.version}`);
console.log('  PASS: package version 80.0.0 or later');

assert.ok(pkg.scripts['smoke:kosame-command-center-complete'],   'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:kosame-command-center-complete'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:kosame-command-center-complete exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-kosame-command-center-complete-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '80.0.0');
console.log('  PASS: tool meta version 80.0.0');

const result = tool.buildCommandCenterComplete({});

assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

// includes v76-v79
assert.ok(result.executiveDashboardSnapshot && result.executiveDashboardSnapshot.dashboardSnapshotId, 'executiveDashboardSnapshot (v76) must exist');
console.log('  PASS: includes v76 executiveDashboardSnapshot');

assert.ok(result.guardianRevenueVisualBoard && result.guardianRevenueVisualBoard.visualBoardId, 'guardianRevenueVisualBoard (v77) must exist');
console.log('  PASS: includes v77 guardianRevenueVisualBoard');

assert.ok(result.humanYesQueueBoard && result.humanYesQueueBoard.yesQueueId, 'humanYesQueueBoard (v78) must exist');
console.log('  PASS: includes v78 humanYesQueueBoard');

assert.ok(result.multiProductProgressBoard && result.multiProductProgressBoard.progressBoardId, 'multiProductProgressBoard (v79) must exist');
console.log('  PASS: includes v79 multiProductProgressBoard');

// dashboardText contains required sections
const dt = result.dashboardText;
assert.ok(typeof dt === 'string' && dt.length > 100, 'dashboardText must be a non-trivial string');
assert.ok(dt.includes('KOSAME Command Center'), 'dashboardText must contain KOSAME Command Center');
assert.ok(dt.includes('VERSION'),               'dashboardText must contain VERSION');
assert.ok(dt.includes('PRODUCTS'),              'dashboardText must contain PRODUCTS');
assert.ok(dt.includes('GUARDIAN'),              'dashboardText must contain GUARDIAN');
assert.ok(dt.includes('REVENUE'),               'dashboardText must contain REVENUE');
assert.ok(dt.includes('HUMAN YES QUEUE'),       'dashboardText must contain HUMAN YES QUEUE');
assert.ok(dt.includes('NEXT ACTION'),           'dashboardText must contain NEXT ACTION');
console.log('  PASS: dashboardText contains KOSAME Command Center/VERSION/PRODUCTS/GUARDIAN/REVENUE/HUMAN YES QUEUE/NEXT ACTION');

// completeCriteria
assert.ok(Array.isArray(result.completeCriteria) && result.completeCriteria.length >= 8, 'completeCriteria must have 8+ items');
const criteriaStr = result.completeCriteria.join(' ').toLowerCase();
assert.ok(criteriaStr.includes('deploy'),        'completeCriteria must mention no deploy');
assert.ok(criteriaStr.includes('secret'),        'completeCriteria must mention no secret read');
assert.ok(criteriaStr.includes('external repo'), 'completeCriteria must mention no external repo mutation');
console.log('  PASS: completeCriteria all present (deploy/secret/external repo mentioned)');

// completePackReady true when no blockers
assert.strictEqual(result.completePackReady, true, 'completePackReady must be true when no blockers');
console.log('  PASS: completePackReady true when no blockers');

// blocked scenario
const blocked = tool.buildCommandCenterComplete({ blockers: ['v77 visual board not reviewed'] });
assert.strictEqual(blocked.completePackReady, false, 'completePackReady must be false with blockers');
console.log('  PASS: completePackReady false with blockers');

// no deploy/secret/customer data in dangerous actions
const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('deploy')),            'must deny deploy');
assert.ok(denied.some(d => d.includes('secret read')),       'must deny secret read');
assert.ok(denied.some(d => d.includes('customer data')),     'must deny customer data read');
assert.ok(denied.some(d => d.includes('external repo')),     'must deny external repo mutation');
assert.ok(denied.some(d => d.includes('Discord') || d.toLowerCase().includes('webhook')), 'must deny Discord/Webhook');
console.log('  PASS: dangerousActionsDenied correct (deploy/secret/customer data/external repo/Discord)');

// humanApprovalPacket
assert.ok(result.humanApprovalPacket && result.humanApprovalPacket.junyaApprovalRequired === true, 'humanApprovalPacket must exist');
console.log('  PASS: humanApprovalPacket exists');

// operatingPolicy
assert.ok(Array.isArray(result.commandCenterOperatingPolicy) && result.commandCenterOperatingPolicy.length >= 8, 'commandCenterOperatingPolicy must have 8+ items');
assert.ok(tool.COMMAND_CENTER_OPERATING_POLICY.some(p => p.includes('Discord')), 'policy must mention Discord not connected');
console.log('  PASS: commandCenterOperatingPolicy exists (Discord not connected mentioned)');

console.log('=== dev-agent-kosame-command-center-complete-pack smoke PASSED ===');
