'use strict';

function compareVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0; const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/first-human-approval-packet-console-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-human-approval-packet-console-pack smoke ===');

assert.ok(compareVersion(pkg.version, '14.0.0') >= 0, `package version must be 14.0.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 14.0.0 or later');

assert.ok(pkg.scripts['smoke:first-human-approval-packet-console-pack'], 'smoke:first-human-approval-packet-console-pack must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-human-approval-packet-console'], 'pm-agent:first-human-approval-packet-console must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v14.0.0-release-record.md')),
  'v14.0.0 release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/first-human-approval-packet-console.sample.json')),
  'fixture first-human-approval-packet-console.sample.json must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '14.0.0', 'tool meta version must be 14.0.0');
console.log('  PASS: tool meta version 14.0.0');

const packet = tool.buildApprovalConsole({
  projectName:  'kosame-dev-orchestra',
  taskGoal:     'KOSAME Dev Orchestra READMEにv10.0.0 Full Orchestra Agent Runtimeの説明を追加する',
  targetFiles:  ['README.md'],
  allowedFiles: ['./tools/**', './smoke/**', './fixtures/**', './docs/ai-dev-team/**', './README.md'],
  deniedFiles:  ['./.env', './.env.*', './secrets/**', './credentials/**'],
  claudePrompt: '# Claude Implementation Prompt\n## Task\nAdd docs to README.\n## allowedFiles\n- ./README.md\n## deniedFiles\n- ./.env\n## verifyCommands\n- npm run verify\n## doneCriteria\n- README updated\n## forbiddenActions\n- git commit\n- git push\n- git tag\n## Safety Rules\n- git add / git commit / git push / git tag はしない\n- Secret / .env / API key は読まない',
  verificationPlan: {
    steps: [
      { step: 'npm run verify', required: true, category: 'verify' },
      { step: 'git status --short', required: true, category: 'git status' }
    ]
  },
  rollbackNote: 'git checkout -- README.md if needed.',
  riskLevel:    'low',
  dataLevel:    'A',
  approvalMode: 'dry-run'
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.humanApprovalConsoleId, 'humanApprovalConsoleId must be present');
console.log('  PASS: humanApprovalConsoleId present');

assert.ok(packet.approvalSummary, 'approvalSummary must be present');
console.log('  PASS: approvalSummary present');

assert.ok(packet.yesNoDecisionPacket, 'yesNoDecisionPacket must be present');
console.log('  PASS: yesNoDecisionPacket present');

assert.ok('approveToSendClaudePrompt' in packet.yesNoDecisionPacket,
  'yesNoDecisionPacket must include approveToSendClaudePrompt');
console.log('  PASS: yesNoDecisionPacket includes approveToSendClaudePrompt');

assert.strictEqual(packet.yesNoDecisionPacket.approveToDeploy,       false, 'approveToDeploy must be false');
console.log('  PASS: approveToDeploy false');

assert.strictEqual(packet.yesNoDecisionPacket.approveToReadSecrets,   false, 'approveToReadSecrets must be false');
console.log('  PASS: approveToReadSecrets false');

assert.strictEqual(packet.yesNoDecisionPacket.approveToUseRealApi,    false, 'approveToUseRealApi must be false');
console.log('  PASS: approveToUseRealApi false');

assert.ok(packet.approvalChecklist, 'approvalChecklist must be present');
console.log('  PASS: approvalChecklist present');

assert.ok(Array.isArray(packet.dangerousActionGates), 'dangerousActionGates must be array');
assert.ok(packet.dangerousActionGates.includes('git push'),  'dangerousActionGates must include git push');
assert.ok(packet.dangerousActionGates.includes('git tag'),   'dangerousActionGates must include git tag');
assert.ok(packet.dangerousActionGates.includes('deploy'),    'dangerousActionGates must include deploy');
assert.ok(packet.dangerousActionGates.includes('secret'),    'dangerousActionGates must include secret');
console.log('  PASS: dangerousActionGates includes git push / git tag / deploy / secret');

assert.ok(Array.isArray(packet.finalDecisionOptions), 'finalDecisionOptions must be array');
assert.ok(packet.finalDecisionOptions.includes('approve'), 'finalDecisionOptions must include approve');
assert.ok(packet.finalDecisionOptions.includes('revise'),  'finalDecisionOptions must include revise');
assert.ok(packet.finalDecisionOptions.includes('reject'),  'finalDecisionOptions must include reject');
assert.ok(packet.finalDecisionOptions.includes('hold'),    'finalDecisionOptions must include hold');
console.log('  PASS: finalDecisionOptions includes approve / revise / reject / hold');

assert.strictEqual(packet.approvalPacketPassed, true, 'approvalPacketPassed must be true');
console.log('  PASS: approvalPacketPassed true');

assert.strictEqual(packet.noRealApiExecution, true, 'noRealApiExecution must be true');
console.log('  PASS: no real API execution');

assert.strictEqual(packet.noRealFileEdit, true, 'noRealFileEdit must be true');
console.log('  PASS: no real file edit');

assert.ok(typeof packet.recommendedNextAction === 'string' && packet.recommendedNextAction.length > 0,
  'recommendedNextAction must be present');
console.log('  PASS: recommendedNextAction present');

console.log('PASS: first-human-approval-packet-console-pack');
