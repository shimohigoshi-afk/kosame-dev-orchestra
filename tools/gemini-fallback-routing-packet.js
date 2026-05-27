/**
 * Gemini Fallback Routing Packet v2.1.0
 *
 * Generates a standard handoff packet when Gemini stops,
 * to be passed to Claude for task continuation.
 */

const { classifyGeminiFallbackTrigger } = require('./provider-health-status.js');

function generateFallbackRoutingPacket(params) {
  const {
    originalTask,
    geminiStopReason,
    geminiStopDetail = '',
    currentState = {},
    filesModified = [],
    filesNotYetModified = []
  } = params;

  const triggerType = classifyGeminiFallbackTrigger(geminiStopDetail || geminiStopReason);

  return {
    packetType: 'gemini_fallback_routing_packet',
    version: '2.1.0',
    timestamp: new Date().toISOString(),
    geminiStatus: {
      stopReason: geminiStopReason,
      stopDetail: geminiStopDetail,
      triggerClassification: triggerType,
      isAuthError: ['auth_error', 'metadata_server_error', 'refresh_token_error'].includes(triggerType),
      isQuotaError: triggerType === 'QUOTA_EXHAUSTED'
    },
    originalTask: {
      description: originalTask.description || '',
      targetVersion: originalTask.targetVersion || '',
      targetFiles: originalTask.targetFiles || [],
      constraints: originalTask.constraints || []
    },
    currentState: {
      packageVersion: currentState.packageVersion || 'unknown',
      verifyStatus: currentState.verifyStatus || 'unknown',
      lastKnownGoodCommit: currentState.lastKnownGoodCommit || 'unknown'
    },
    progress: {
      filesModified,
      filesNotYetModified,
      estimatedCompletion: filesNotYetModified.length === 0 ? '100%' : 'partial'
    },
    claudeInstructions: [
      'このpacketはGemini課長の停止によりClaudeへの引き継ぎとして生成されました',
      'originalTask.descriptionに従いタスクを継続してください',
      'Geminiが途中まで実施した場合はprogress.filesModifiedを確認してください',
      'filesNotYetModifiedを優先的に完了してください',
      '完了後はnpm run verifyを実行してください',
      '完了報告はこさめ副社長へ行い、approval packetを生成してください'
    ],
    safetyConstraints: [
      'git push禁止（じゅんやさん最終YES後のみ）',
      'git tag禁止（じゅんやさん最終YES後のみ）',
      'deploy禁止',
      'rm -rf禁止',
      'Secret/.env/APIkey読み取り禁止'
    ],
    dryRun: true
  };
}

module.exports = { generateFallbackRoutingPacket };

if (require.main === module) {
  const samplePacket = generateFallbackRoutingPacket({
    originalTask: {
      description: 'v2.1.0 AI Provider Routing & Kosame Approval Delegation の実装',
      targetVersion: '2.1.0',
      targetFiles: [
        'docs/ai-dev-team/provider-routing-policy-v2.1.0.md',
        'tools/provider-health-status.js',
        'tools/gemini-fallback-routing-packet.js'
      ],
      constraints: ['既存構造を壊さない', 'npm run verifyが通ること']
    },
    geminiStopReason: 'auth_error',
    geminiStopDetail: 'metadata server application default credentials / refresh_token error',
    currentState: {
      packageVersion: '2.0.0',
      verifyStatus: 'passed',
      lastKnownGoodCommit: '76d0e3b'
    },
    filesModified: [],
    filesNotYetModified: [
      'docs/ai-dev-team/provider-routing-policy-v2.1.0.md',
      'tools/provider-health-status.js',
      'tools/gemini-fallback-routing-packet.js',
      'tools/operator-decision-engine-v2.1.0.js'
    ]
  });

  console.log(JSON.stringify(samplePacket, null, 2));
}
