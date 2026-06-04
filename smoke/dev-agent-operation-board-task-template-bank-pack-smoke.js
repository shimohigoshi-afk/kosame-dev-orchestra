'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-operation-board-task-template-bank-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-operation-board-task-template-bank-pack smoke ===');

// package version >= 49
assert.ok(
  parseInt(pkg.version.split('.')[0], 10) >= 49,
  `pkg version must be >= 49.0.0, got ${pkg.version}`
);
console.log('  PASS: package version 49.0.0 or later');

// smoke script exists
assert.ok(pkg.scripts['smoke:operation-board-task-template-bank'], 'smoke:operation-board-task-template-bank must exist');
console.log('  PASS: smoke script exists');

// pm-agent script exists
assert.ok(pkg.scripts['pm-agent:task-template-bank'], 'pm-agent:task-template-bank must exist');
console.log('  PASS: pm-agent:task-template-bank must exist');

// fixture exists
assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-operation-board-task-template-bank-pack.fixture.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

// tool meta version
assert.strictEqual(tool.TOOL_META.version, '49.0.0', 'tool version must be 49.0.0');
console.log('  PASS: tool meta version 49.0.0');

// buildTemplateBank
const bank = tool.buildTemplateBank();

// dryRun true
assert.strictEqual(bank.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

// humanApprovalRequired true
assert.strictEqual(bank.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// template bank has 8+ templates
assert.ok(Array.isArray(bank.templates) && bank.templates.length >= 8, 'template bank must have 8+ templates');
console.log('  PASS: template bank has 8+ templates');

// each template has required fields
const requiredTemplateFields = ['templateId', 'title', 'allowedFiles', 'forbiddenFiles', 'verificationCommands', 'doneCriteria', 'humanApprovalRequired', 'forbiddenCommands'];
for (const tpl of bank.templates) {
  for (const field of requiredTemplateFields) {
    assert.ok(tpl[field] !== undefined, `template ${tpl.templateId} must have field: ${field}`);
  }
}
console.log('  PASS: each template has allowedFiles/forbiddenFiles/verificationCommands/doneCriteria');

// forbiddenCommands include prohibited items
for (const tpl of bank.templates) {
  const fc = tpl.forbiddenCommands || [];
  assert.ok(fc.some(c => c.includes('deploy')),     `${tpl.templateId}: forbiddenCommands must include deploy`);
  assert.ok(fc.some(c => c.includes('git push')),   `${tpl.templateId}: forbiddenCommands must include git push`);
  assert.ok(fc.some(c => c.includes('git tag')),    `${tpl.templateId}: forbiddenCommands must include git tag`);
  assert.ok(fc.some(c => c.includes('rm -rf')),     `${tpl.templateId}: forbiddenCommands must include rm -rf`);
  assert.ok(
    fc.some(c => c.includes('.env') || c.toLowerCase().includes('secret')),
    `${tpl.templateId}: forbiddenCommands must include .env or secret`
  );
}
console.log('  PASS: forbiddenCommands include deploy/git push/tag/secret/.env/rm -rf');

// product_repo_controlled_task exists
const productRepoTpl = tool.getTemplate('product_repo_controlled_task');
assert.ok(productRepoTpl, 'product_repo_controlled_task template must exist');
assert.strictEqual(productRepoTpl.templateId, 'product_repo_controlled_task');
assert.ok(productRepoTpl.forbiddenFiles.some(f => f.includes('bot.js')), 'product_repo template must forbid bot.js');
console.log('  PASS: product_repo_controlled_task exists');

// dangerousActionsDenied correct
const denied = bank.dangerousActionsDenied;
assert.ok(Array.isArray(denied) && denied.length >= 4, 'dangerousActionsDenied must have 4+ items');
assert.ok(denied.some(d => d.includes('deploy')),      'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
assert.ok(denied.some(d => d.includes('.env read')),   'dangerousActionsDenied must include .env read');
assert.ok(denied.some(d => d.includes('git push')),    'dangerousActionsDenied must include git push');
console.log('  PASS: dangerousActionsDenied correct');

// getTemplate works
const docsTpl = tool.getTemplate('docs_update');
assert.ok(docsTpl, 'docs_update template must be retrievable');
assert.strictEqual(docsTpl.templateId, 'docs_update');
console.log('  PASS: getTemplate(docs_update) works');

// null for unknown
const unknown = tool.getTemplate('this_does_not_exist');
assert.strictEqual(unknown, null, 'getTemplate returns null for unknown id');
console.log('  PASS: getTemplate returns null for unknown templateId');

// humanApprovalRequired true in every template
for (const tpl of bank.templates) {
  assert.strictEqual(tpl.humanApprovalRequired, true, `${tpl.templateId}: humanApprovalRequired must be true`);
}
console.log('  PASS: humanApprovalRequired true in all templates');

// FORBIDDEN_COMMANDS_ALWAYS exported
assert.ok(Array.isArray(tool.FORBIDDEN_COMMANDS_ALWAYS) && tool.FORBIDDEN_COMMANDS_ALWAYS.length >= 8, 'FORBIDDEN_COMMANDS_ALWAYS must be exported');
console.log('  PASS: FORBIDDEN_COMMANDS_ALWAYS exported');

console.log('=== dev-agent-operation-board-task-template-bank-pack smoke PASSED ===');
