'use strict';

const TOOL_META = {
  version: '9.0.0',
  title: 'Orchestra Result Merger',
  slug: 'orchestra-result-merger-pack'
};

const BLOCKED_DANGEROUS_ACTIONS = [
  'git push', 'git tag', 'deploy', 'gcloud deploy', 'docker build',
  'secret', '.env', 'api key', 'customer data', 'destructive action', 'rm -rf'
];

const REVIEW_DECISIONS = ['adopted', 'partial_adopt', 'rejected', 'human_review', 'escalate'];

function generateMergerId(originalTask) {
  const ts = Date.now();
  const slug = String(originalTask || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 24);
  return `merger-${slug}-${ts}`;
}

function normalizeAgentResult(agentId, rawResult) {
  if (!rawResult) {
    return {
      agentId,
      status: 'missing',
      summary: '(no result provided)',
      concerns: [],
      adoptable: false
    };
  }
  const text = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
  const hasConcern = /error|fail|issue|concern|problem|warning/i.test(text);
  return {
    agentId,
    status: 'received',
    summary: text.slice(0, 500),
    concerns: hasConcern ? ['Potential issue detected in result text'] : [],
    adoptable: !hasConcern
  };
}

function classifyItems(geminiNorm, grokNorm, claudeNorm) {
  const adopted   = [];
  const rejected  = [];
  const unresolved = [];

  for (const norm of [geminiNorm, grokNorm, claudeNorm]) {
    if (norm.status === 'missing') {
      unresolved.push({ agentId: norm.agentId, reason: 'No result provided' });
    } else if (norm.adoptable && norm.concerns.length === 0) {
      adopted.push({ agentId: norm.agentId, summary: norm.summary.slice(0, 200) });
    } else if (!norm.adoptable) {
      rejected.push({ agentId: norm.agentId, concerns: norm.concerns });
    } else {
      unresolved.push({ agentId: norm.agentId, reason: 'Has concerns — requires kosame review' });
    }
  }
  return { adopted, rejected, unresolved };
}

function buildMergeDecisionPacket(originalTask, adopted, rejected, unresolved, reviewDecision) {
  return {
    mergeDecisionType: reviewDecision,
    originalTask,
    adoptedCount: adopted.length,
    rejectedCount: rejected.length,
    unresolvedCount: unresolved.length,
    noRealFileMerge: true,
    note: '実ファイルの自動マージは禁止。このパケットは採用判断のみを含む。コードの自動適用はしない。',
    adoptedSummaries: adopted.map(a => ({ agentId: a.agentId, summary: a.summary })),
    rejectedReasons:  rejected.map(r => ({ agentId: r.agentId, concerns: r.concerns })),
    unresolvedItems:  unresolved,
    generatedAt: new Date().toISOString()
  };
}

function determineReviewDecision(adopted, rejected, unresolved, verificationSummary) {
  const verifyOk = verificationSummary && /pass|ok|success/i.test(String(verificationSummary));

  if (unresolved.length > 0) return 'human_review';
  if (rejected.length > 0 && adopted.length === 0) return 'rejected';
  if (rejected.length > 0 && adopted.length > 0) return 'partial_adopt';
  if (adopted.length > 0 && rejected.length === 0 && unresolved.length === 0) {
    return verifyOk ? 'adopted' : 'human_review';
  }
  return 'human_review';
}

function buildPacket(input) {
  const geminiResult       = input.geminiResult       || null;
  const grokResult         = input.grokResult         || null;
  const claudeResult       = input.claudeResult       || null;
  const originalTask       = String(input.originalTask || '(unknown task)');
  const safetyBoundary     = input.safetyBoundary     || {};
  const verificationSummary = input.verificationSummary || null;

  const mergerId = generateMergerId(originalTask);

  const geminiNorm = normalizeAgentResult('gemini', geminiResult);
  const grokNorm   = normalizeAgentResult('grok',   grokResult);
  const claudeNorm = normalizeAgentResult('claude',  claudeResult);

  const normalizedResults = { gemini: geminiNorm, grok: grokNorm, claude: claudeNorm };
  const { adopted, rejected, unresolved } = classifyItems(geminiNorm, grokNorm, claudeNorm);
  const reviewDecision = determineReviewDecision(adopted, rejected, unresolved, verificationSummary);
  const mergeDecisionPacket = buildMergeDecisionPacket(originalTask, adopted, rejected, unresolved, reviewDecision);

  const humanReviewRequired = ['human_review', 'escalate'].includes(reviewDecision);

  const recommendedNextAction = humanReviewRequired
    ? 'Route to こさめ/じゅんやさん for human review — unresolved or rejected items present'
    : reviewDecision === 'adopted'
      ? 'All results adopted — route to final approval packet for commit/push/tag'
      : 'Partial adopt — route to こさめ for merge arbitration before proceeding';

  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    mergerId,
    originalTask,
    normalizedResults,
    adoptedItems: adopted,
    rejectedItems: rejected,
    unresolvedItems: unresolved,
    mergeDecisionPacket,
    reviewDecision,
    humanReviewRequired,
    safetyBoundary,
    verificationSummary,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS,
    recommendedNextAction
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    geminiResult:        'Spec clarification complete. Fixtures generated. No concerns.',
    grokResult:          'Weakness analysis complete. 2 potential edge cases identified.',
    claudeResult:        'Implementation complete. All smoke tests pass. npm run verify: OK.',
    originalTask:        'implement release note generator',
    safetyBoundary:      { dataLevel: 'A', riskLevel: 'low' },
    verificationSummary: 'npm run verify PASS'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  REVIEW_DECISIONS,
  BLOCKED_DANGEROUS_ACTIONS,
  generateMergerId,
  normalizeAgentResult,
  classifyItems,
  buildMergeDecisionPacket,
  determineReviewDecision,
  buildPacket
};
