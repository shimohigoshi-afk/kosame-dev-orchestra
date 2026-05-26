/**
 * Smoke Test: GitHub Actions Result Review
 * v0.6.2
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { GitHubActionsResultReview } = require('../tools/github-actions-result-review-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: GitHub Actions Result Review...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/github-actions-result-review-v0.6.2.md',
    'docs/ai-dev-team/actions-failure-triage-v0.6.2.md',
    'docs/ai-dev-team/actions-success-release-record-v0.6.2.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Reviewer 動作確認
  const reviewer = new GitHubActionsResultReview();
  const run = {
    id: '12345',
    name: 'KOSAME Dev Orchestra Verify',
    conclusion: 'failure',
    url: 'https://github.com/run/12345'
  };

  const result = reviewer.reviewRun(run);
  assert.strictEqual(result.runId, '12345');
  assert.strictEqual(result.conclusion, 'failure');
  assert.strictEqual(result.nextAction, 'claude-repair');

  console.log('Smoke Test: GitHub Actions Result Review PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: GitHub Actions Result Review FAILED');
  console.error(err);
  process.exit(1);
});
