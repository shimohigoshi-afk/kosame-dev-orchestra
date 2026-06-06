'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const tool = require('../tools/dev-agent-reliability-score-pack.js');
const pkg  = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-reliability-score-pack smoke ===');

// 1. package version
function semverGte(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return true;
}
assert.ok(semverGte(pkg.version, '110.3.0'), 'package version must be 110.3.0 or later');
console.log('  PASS: package version >= 110.3.0');

// 2. tool meta version
assert.strictEqual(tool.TOOL_META.version, '110.3.0');
console.log('  PASS: tool meta version is 110.3.0');

// 3. Claude Code implementation: STRONG when context controlled
const r1 = tool.scoreReliability({ provider: 'claude_code', taskType: 'implementation' });
assert.strictEqual(r1.scoreBand, tool.SCORE_BANDS.STRONG);
assert.strictEqual(r1.shouldUse, true);
assert.strictEqual(r1.dryRun, true);
assert.strictEqual(r1.realProductActionsExecuted, false);
console.log('  PASS: claude_code implementation is STRONG');

// 4. Gemini long preprocessing: STRONG
const r2 = tool.scoreReliability({ provider: 'gemini', taskType: 'long_preprocessing' });
assert.strictEqual(r2.scoreBand, tool.SCORE_BANDS.STRONG);
console.log('  PASS: gemini long_preprocessing is STRONG');

// 5. GPT PM/judge role: AVOID (limited score)
const r3 = tool.scoreReliability({ provider: 'gpt', taskType: 'pm_decision' });
assert.strictEqual(r3.scoreBand, tool.SCORE_BANDS.AVOID);
assert.strictEqual(r3.shouldFallback, true);
console.log('  PASS: GPT pm_decision is AVOID');

// 6. GPT execution assistant (log_summarization): OK or STRONG
const r4 = tool.scoreReliability({ provider: 'gpt', taskType: 'log_summarization' });
assert.ok(
  r4.scoreBand === tool.SCORE_BANDS.STRONG || r4.scoreBand === tool.SCORE_BANDS.OK,
  `expected STRONG or OK, got ${r4.scoreBand}`
);
assert.strictEqual(r4.shouldUse, true);
console.log(`  PASS: GPT log_summarization is ${r4.scoreBand} (execution assistant OK)`);

// 7. Grok breakthrough: STRONG or OK
const r5 = tool.scoreReliability({ provider: 'grok', taskType: 'breakthrough' });
assert.ok(
  r5.scoreBand === tool.SCORE_BANDS.STRONG || r5.scoreBand === tool.SCORE_BANDS.OK,
  `expected STRONG or OK, got ${r5.scoreBand}`
);
console.log(`  PASS: grok breakthrough is ${r5.scoreBand}`);

// 8. DeepSeek implementation: AVOID
const r6 = tool.scoreReliability({ provider: 'deepseek', taskType: 'implementation' });
assert.strictEqual(r6.scoreBand, tool.SCORE_BANDS.AVOID);
console.log('  PASS: deepseek implementation is AVOID');

// 9. Kimi: AVOID for non-advisory tasks
const r7 = tool.scoreReliability({ provider: 'kimi', taskType: 'implementation' });
assert.strictEqual(r7.scoreBand, tool.SCORE_BANDS.AVOID);
console.log('  PASS: kimi implementation is AVOID');

// 10. Human: HUMAN_GATE for irreversible approval
const r8 = tool.scoreReliability({ provider: 'human', taskType: 'irreversible_approval' });
assert.strictEqual(r8.scoreBand, tool.SCORE_BANDS.HUMAN_GATE);
console.log('  PASS: human irreversible_approval is HUMAN_GATE');

// 11. Conservative detour lowers score
const r9base = tool.scoreReliability({ provider: 'gpt', taskType: 'log_summarization' });
const r9deto = tool.scoreReliability({ provider: 'gpt', taskType: 'log_summarization', conservativeBrakeDetected: true });
assert.ok(r9deto.reliabilityScore < r9base.reliabilityScore, 'conservative_brake must lower score');
assert.ok(r9deto.reasons.some(r => r.includes('conservative_brake')));
console.log('  PASS: conservative detour lowers reliability score');

// 12. dryRun / realProductActionsExecuted
assert.strictEqual(r1.dryRun, true);
assert.strictEqual(r1.realProductActionsExecuted, false);
console.log('  PASS: dryRun true, realProductActionsExecuted false');

// fixture exists
assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-reliability-score-pack.fixture.json')));
console.log('  PASS: fixture exists');

console.log('PASS: dev-agent-reliability-score-pack');
