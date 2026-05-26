"use strict";

// KOSAME Cloud Run PM Agent — Runtime Monitoring Pack (v0.4.7)
// Generates monitoring checklists and log review queries.
// No external API calls. No .env/secrets.

function generateMonitoringChecklist(options) {
  const opts = options || {};
  const serviceName = opts.serviceName || "pm-agent";
  const projectId = opts.projectId || "PROJECT_ID_PLACEHOLDER";

  return {
    description: "Cloud Run PM Agent — Runtime Monitoring Pack (v0.4.7)",
    version: "0.4.7",
    dryRun: true,
    serviceName,
    projectId,
    monitoringItems: [
      { category: "Availability", item: "GET /health", threshold: "99.9%" },
      { category: "Performance", item: "Latency (p95)", threshold: "< 10s" },
      { category: "Reliability", item: "Error Rate (5xx)", threshold: "< 1%" },
      { category: "Resources", item: "CPU/Memory Usage", threshold: "< 80%" },
    ],
    logQueries: {
      allErrors: `resource.type="cloud_run_revision" AND severity>=ERROR`,
      timeouts: `resource.type="cloud_run_revision" AND (textPayload:"timeout" OR textPayload:"deadline")`,
      apiFailures: `resource.type="cloud_run_revision" AND (textPayload:"GoogleGenerativeAIError" OR textPayload:"OpenAIError")`,
    },
    dailyChecklist: [
      "[ ] Check Cloud Run console for revision health",
      "[ ] Review Error Reporting for new exceptions",
      "[ ] Verify Daily Billing is within expected range",
      "[ ] Scan logs for sensitive data leaks (e.g., API keys)",
    ],
    safetyGates: [
      "Significant resource changes require Human Approval",
      "Scaling policy updates require Human Approval",
    ],
  };
}

if (require.main === module) {
  const result = generateMonitoringChecklist();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { generateMonitoringChecklist };
