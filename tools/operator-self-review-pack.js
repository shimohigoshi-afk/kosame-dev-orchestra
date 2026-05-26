/**
 * Operator Self Review Pack v1.3.0
 *
 * Self-review rubric for operator console release readiness.
 */

const RUBRIC = [
  { criterion: 'All smoke tests pass', weight: 'critical' },
  { criterion: 'No forbidden actions in scripts', weight: 'critical' },
  { criterion: 'Safety contract validated', weight: 'critical' },
  { criterion: 'Human approval gates present', weight: 'critical' },
  { criterion: 'Completion checklist 100%', weight: 'high' },
  { criterion: 'Smoke registry up-to-date', weight: 'high' },
  { criterion: 'README updated', weight: 'medium' },
  { criterion: 'Handoff document generated', weight: 'medium' },
  { criterion: 'No .env or Secret access', weight: 'critical' },
  { criterion: 'package.json version matches milestone', weight: 'high' }
];

function runSelfReview(passedCriteria = []) {
  const results = RUBRIC.map(r => ({
    ...r,
    passed: passedCriteria.includes(r.criterion)
  }));

  const critical = results.filter(r => r.weight === 'critical');
  const allCriticalPassed = critical.every(r => r.passed);

  return {
    version: '1.3.0',
    timestamp: new Date().toISOString(),
    rubric: results,
    summary: {
      totalCriteria: results.length,
      passed: results.filter(r => r.passed).length,
      criticalTotal: critical.length,
      criticalPassed: critical.filter(r => r.passed).length,
      allCriticalPassed
    },
    verdict: allCriticalPassed ? 'RELEASE_READY' : 'NOT_READY',
    dryRun: true
  };
}

module.exports = { runSelfReview, RUBRIC };

if (require.main === module) {
  const result = runSelfReview();
  console.log(JSON.stringify(result, null, 2));
}
