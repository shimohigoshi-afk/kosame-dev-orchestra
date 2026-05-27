/**
 * Smoke Test: Gemini Failure Fallback Policy v2.1.0
 */

const fs = require('fs');
const path = require('path');

function runSmokeTest() {
  console.log('Running smoke test: Gemini Failure Fallback Policy v2.1.0');

  const docPath = path.resolve('docs/ai-dev-team/gemini-failure-fallback-v2.1.0.md');
  if (!fs.existsSync(docPath)) throw new Error(`Missing doc: ${docPath}`);

  const content = fs.readFileSync(docPath, 'utf8');
  const requiredPatterns = [
    'QUOTA_EXHAUSTED',
    'timeout',
    'auth_error',
    'metadata server application default credentials',
    'refresh_token',
    '10分以上無反応',
    'gemini_needs_fallback',
    'gemini_auth_error'
  ];

  for (const pattern of requiredPatterns) {
    if (!content.includes(pattern)) throw new Error(`Doc missing pattern: ${pattern}`);
  }

  console.log('Smoke test PASSED');
  return { version: '2.1.0', purpose: 'Gemini Failure Fallback Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try {
    const report = runSmokeTest();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error('Smoke test FAILED:', error.message);
    process.exit(1);
  }
}
