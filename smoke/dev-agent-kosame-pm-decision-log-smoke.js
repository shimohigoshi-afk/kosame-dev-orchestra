/**
 * Smoke Test: Kosame PM Decision Log
 * v0.5.3
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { KosamePMDecisionLog } = require('../tools/kosame-pm-decision-log-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Kosame PM Decision Log...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/kosame-pm-decision-log-v0.5.3.md',
    'docs/ai-dev-team/decision-log-schema-v0.5.3.md',
    'docs/ai-dev-team/pm-review-before-commit-policy-v0.5.3.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Decision Log 動作確認
  const logger = new KosamePMDecisionLog();
  const entry = logger.record({
    commandId: 'CMD-001',
    decision: 'approved',
    rationale: 'Verify passed and no security issues found.',
    nextAction: 'git commit'
  });

  assert.ok(entry.decisionId.startsWith('DEC-'));
  assert.strictEqual(entry.decision, 'approved');
  assert.strictEqual(logger.logs.length, 1);

  const found = logger.getDecisionByCommandId('CMD-001');
  assert.strictEqual(found.decisionId, entry.decisionId);

  console.log('Smoke Test: Kosame PM Decision Log PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Kosame PM Decision Log FAILED');
  console.error(err);
  process.exit(1);
});
