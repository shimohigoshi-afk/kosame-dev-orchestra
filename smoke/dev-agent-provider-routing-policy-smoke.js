/**
 * Smoke Test: Provider Routing Policy v2.1.0
 */

const fs = require('fs');
const path = require('path');

function runSmokeTest() {
  console.log('Running smoke test: Provider Routing Policy v2.1.0');

  const docPath = path.resolve('docs/ai-dev-team/provider-routing-policy-v2.1.0.md');
  if (!fs.existsSync(docPath)) throw new Error(`Missing doc: ${docPath}`);

  const content = fs.readFileSync(docPath, 'utf8');
  if (!content.includes('Provider Routing Policy')) throw new Error('Doc missing title');
  if (!content.includes('Gemini')) throw new Error('Doc missing Gemini entry');
  if (!content.includes('Claude')) throw new Error('Doc missing Claude entry');
  if (!content.includes('GitHub Actions')) throw new Error('Doc missing GitHub Actions entry');
  if (!content.includes('gemini_auth_error')) throw new Error('Doc missing auth_error state');

  console.log('Smoke test PASSED');
  return { version: '2.1.0', purpose: 'Provider Routing Policy Smoke Test', status: 'passed', dryRun: true };
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
