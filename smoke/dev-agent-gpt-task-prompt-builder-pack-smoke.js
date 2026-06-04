'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const fixture = require('../fixtures/dev-agent-gpt-task-prompt-builder-pack.fixture.json');
const tool = require('../tools/dev-agent-gpt-task-prompt-builder-pack');

function pass(message) { console.log(`  PASS: ${message}`); }

console.log('=== dev-agent-gpt-task-prompt-builder-pack smoke ===');

assert.ok(pkg.version >= '87.0.0'); pass('package version 87.0.0 or later');
assert.ok(fs.existsSync(__filename)); pass('smoke script exists');
assert.ok(pkg.scripts['pm-agent:gpt-task-prompt-builder']); pass('pm-agent:gpt-task-prompt-builder exists');
assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-gpt-task-prompt-builder-pack.fixture.json'))); pass('fixture exists');
assert.strictEqual(tool.TOOL_META.version, '87.0.0'); pass('tool meta version 87.0.0');

const result = tool.buildGptTaskPromptBuilder(fixture);
assert.ok(result.promptText); pass('promptText exists');
assert.strictEqual(result.inputFileSupported, true); pass('inputFileSupported true');
assert.ok(result.inputFileRunnerTargets.includes('tools/agent-runner-local.js')); pass('agent-runner-local target exists');
assert.ok(result.inputFileRunnerTargets.includes('tools/agent-live-call-one-shot.js')); pass('agent-live-call-one-shot target exists');
assert.ok(Array.isArray(result.forbiddenCommands) && result.forbiddenCommands.includes('git push')); pass('forbiddenCommands include git push');
assert.ok(result.commitStopRule); pass('commitStopRule exists');
assert.ok(result.dangerousActionsDenied.includes('secret read')); pass('dangerousActionsDenied correct');

console.log('=== dev-agent-gpt-task-prompt-builder-pack smoke PASSED ===');
