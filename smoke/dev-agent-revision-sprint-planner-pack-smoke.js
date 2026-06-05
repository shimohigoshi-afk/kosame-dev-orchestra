'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-revision-sprint-planner-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-revision-sprint-planner-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 104, `pkg version must be >= 104.0.0, got ${pkg.version}`);
console.log('  PASS: package version 104.0.0 or later');

assert.ok(pkg.scripts['smoke:revision-sprint-planner'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:revision-sprint-planner'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:revision-sprint-planner exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-revision-sprint-planner-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '104.0.0');
console.log('  PASS: tool meta version 104.0.0');

const result = tool.buildRevisionSprintPlanner({});
assert.strictEqual(result.dryRun, true);
assert.strictEqual(result.realProductActionsExecuted, false);
console.log('  PASS: dryRun true, realProductActionsExecuted false');

// default generates 1 sprint
assert.strictEqual(result.summary.totalSprints, 1);
console.log('  PASS: default generates 1 sprint');

// sprint structure
const sprint = result.sprints[0];
assert.ok(sprint.sprintId, 'sprint must have sprintId');
assert.ok(sprint.product, 'sprint must have product');
assert.ok(sprint.priority, 'sprint must have priority');
assert.ok(Array.isArray(sprint.allowedFiles) && sprint.allowedFiles.length > 0);
assert.ok(Array.isArray(sprint.forbiddenFiles) && sprint.forbiddenFiles.length > 0);
assert.ok(sprint.forbiddenFiles.includes('.env'), 'forbiddenFiles must include .env');
assert.ok(Array.isArray(sprint.verificationCommands));
assert.ok(Array.isArray(sprint.doneCriteria));
assert.ok(typeof sprint.rollbackNotes === 'string');
assert.ok(sprint.ownerRoute, 'sprint must have ownerRoute');
console.log('  PASS: sprint structure complete');

// critical feedback → human owner
const critical = tool.buildRevisionSprintPlanner({
  feedbackItems: [{
    product: 'anesty_board', category: 'security_concern', severity: 'critical',
    description: 'critical bug', revisionSuggestion: 'patch immediately'
  }]
});
assert.strictEqual(critical.sprints[0].ownerRoute, tool.OWNER_ROUTES.HUMAN);
assert.strictEqual(critical.sprints[0].humanApprovalRequired, true);
console.log('  PASS: critical severity → Human owner, humanApprovalRequired true');

// medium feedback → ClaudeCode owner
const medium = tool.buildRevisionSprintPlanner({
  feedbackItems: [{
    product: 'anesty_board', category: 'usability', severity: 'medium',
    description: 'UI bug', revisionSuggestion: 'fix UI'
  }]
});
assert.strictEqual(medium.sprints[0].ownerRoute, tool.OWNER_ROUTES.CLAUDE_CODE);
console.log('  PASS: medium severity → ClaudeCode owner');

console.log('=== dev-agent-revision-sprint-planner-pack smoke PASSED ===');
