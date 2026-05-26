"use strict";

// KOSAME Cloud Run PM Agent — Release Governance Packet (v0.4.9)
// Generates release approval packets and change logs.
// No external API calls. No .env/secrets.

function generateReleasePacket(options) {
  const opts = options || {};
  const version = opts.version || "0.5.0";
  const changes = opts.changes || ["Initial v0.5.0 expansion packs"];
  const smokeResults = opts.smokeResults || { passed: 0, failed: 0 };

  return {
    description: "Release Governance Packet (v0.4.9)",
    version: version,
    releaseDate: new Date().toISOString().split("T")[0],
    dryRun: true,
    status: "PENDING_APPROVAL",
    changelog: {
      version: version,
      added: changes,
      fixed: [],
      security: [],
    },
    verification: {
      smokeTests: smokeResults,
      lintStatus: "PENDING",
      typeCheckStatus: "PENDING",
    },
    approvalRequest: {
      to: "Junya-san",
      template: `【リリース承認依頼】\nバージョン: v${version}\n概要: ${changes.join(", ")}\n検証: smoke test ${smokeResults.passed}件 PASS / ${smokeResults.failed}件 FAIL\n承認をお願いします。`,
    },
    rollbackPlan: {
      command: "gcloud run services update-traffic pm-agent --to-revisions PREVIOUS_REVISION=100",
      riskLevel: "Low",
    },
  };
}

if (require.main === module) {
  const result = generateReleasePacket();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { generateReleasePacket };
