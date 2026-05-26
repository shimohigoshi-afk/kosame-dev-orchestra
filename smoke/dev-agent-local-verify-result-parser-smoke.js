/**
 * Smoke Test: Local Verify Result Parser
 * v0.6.3
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { LocalVerifyResultParser } = require('../tools/local-verify-result-parser-pack');

async function runSmokeTest() {
  console.log('Running Smoke Test: Local Verify Result Parser...');

  // 1. ファイル存在確認
  const docs = [
    'docs/ai-dev-team/local-verify-result-parser-v0.6.3.md',
    'docs/ai-dev-team/verify-output-classification-v0.6.3.md',
    'docs/ai-dev-team/verify-pass-fail-next-action-v0.6.3.md'
  ];

  for (const doc of docs) {
    assert.ok(fs.existsSync(path.resolve(doc)), `Missing doc: ${doc}`);
  }

  // 2. Parser 動作確認
  const parser = new LocalVerifyResultParser();
  
  const passOutput = 'Smoke Test: Operator Command Packet PASSED\nSmoke Test: Agent Dispatch Queue PASSED';
  assert.strictEqual(parser.parse(passOutput).summary, 'PASS');

  const failOutput = 'AssertionError [ERR_ASSERTION]: Missing doc\nSmoke Test: FAILED';
  assert.strictEqual(parser.parse(failOutput).summary, 'LOGIC_FAIL');

  const syntaxOutput = 'SyntaxError: Unexpected token {';
  assert.strictEqual(parser.parse(syntaxOutput).summary, 'SYNTAX_ERROR');

  console.log('Smoke Test: Local Verify Result Parser PASSED');
}

runSmokeTest().catch(err => {
  console.error('Smoke Test: Local Verify Result Parser FAILED');
  console.error(err);
  process.exit(1);
});
