'use strict';

const TOOL_META = {
  version: '5.6.0',
  title: 'Provider Health Auto Reporter',
  slug: 'provider-health-auto-reporter-pack'
};

const PROVIDERS = ['kosame', 'claude', 'gemini', 'grok', 'deepseek', 'kimi', 'cloudShell', 'human'];

const HEALTH_THRESHOLDS = {
  successRateWarning: 0.8,
  successRateCritical: 0.5,
  latencyWarningMs: 5000,
  latencyCriticalMs: 15000
};

function evaluateHealth(stats = {}) {
  const successRate = typeof stats.successRate === 'number' ? stats.successRate : 1.0;
  const latencyMs = typeof stats.latencyMs === 'number' ? stats.latencyMs : 0;

  let status = 'healthy';
  const alerts = [];

  if (successRate < HEALTH_THRESHOLDS.successRateCritical) {
    status = 'critical';
    alerts.push(`success rate critical: ${successRate}`);
  } else if (successRate < HEALTH_THRESHOLDS.successRateWarning) {
    status = 'warning';
    alerts.push(`success rate warning: ${successRate}`);
  }

  if (latencyMs > HEALTH_THRESHOLDS.latencyCriticalMs) {
    status = 'critical';
    alerts.push(`latency critical: ${latencyMs}ms`);
  } else if (latencyMs > HEALTH_THRESHOLDS.latencyWarningMs) {
    if (status === 'healthy') status = 'warning';
    alerts.push(`latency warning: ${latencyMs}ms`);
  }

  return { status, alerts, successRate, latencyMs };
}

function generateReport(providerStats = {}) {
  const report = {};
  for (const provider of PROVIDERS) {
    report[provider] = evaluateHealth(providerStats[provider] || {});
  }
  const criticalProviders = Object.entries(report)
    .filter(([, v]) => v.status === 'critical')
    .map(([k]) => k);
  return { report, criticalProviders, humanApprovalRequired: true };
}

function buildPacket(input = {}) {
  const providerStats = input.providerStats || {};
  const generated = generateReport(providerStats);
  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    thresholds: HEALTH_THRESHOLDS,
    ...generated
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({}), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  PROVIDERS,
  HEALTH_THRESHOLDS,
  evaluateHealth,
  generateReport,
  buildPacket
};
