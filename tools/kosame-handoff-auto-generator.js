'use strict';
/**
 * Kosame Handoff Auto Generator v3.9.0
 *
 * 現在状態から、次チャットセッション用の引継ぎメモを自動生成する。
 * concise（短い）と detailed（詳細）の2トーンを生成。
 */

const GENERATOR_VERSION = '3.9.0';

const TONE_PROFILES = { CONCISE: 'concise', DETAILED: 'detailed' };

const FORBIDDEN_ACTIONS_LIST = [
  'rm -rf',
  'git reset --hard',
  'git clean -f',
  'cat .env / Secret / APIキー閲覧',
  'gcloud run deploy',
  'docker build',
  '外部API実行 (fetch/curl)',
  '課金API実行',
  '無承認 git push',
  '無承認 git tag'
];

function generateConciseHandoff(data) {
  const {
    currentVersion, currentHead, latestTag, actionsStatus,
    completedWork, uncommittedWork, nextRecommendedAction,
    riskNotes, humanApprovalStatus
  } = data;

  return [
    `# Kosame VP 引継ぎメモ (concise)`,
    ``,
    `- version: ${currentVersion} | head: ${currentHead} | tag: ${latestTag}`,
    `- actions: ${actionsStatus}`,
    `- 完了: ${completedWork.slice(0, 2).join(' / ') || 'なし'}`,
    `- 未コミット: ${uncommittedWork.slice(0, 2).join(' / ') || 'なし'}`,
    `- 次アクション: ${nextRecommendedAction}`,
    `- リスク: ${riskNotes.slice(0, 1).join(' / ') || 'なし'}`,
    `- 承認状態: ${humanApprovalStatus}`
  ].join('\n');
}

function generateDetailedHandoff(data) {
  const {
    currentVersion, currentHead, latestTag, actionsStatus,
    completedWork, uncommittedWork, nextRecommendedAction,
    riskNotes, forbiddenActions, nextClaudePromptSummary,
    nextGeminiFallbackSummary, humanApprovalStatus
  } = data;

  return [
    `# Kosame VP 詳細引継ぎメモ`,
    ``,
    `## 現在状態`,
    `- package version: ${currentVersion}`,
    `- HEAD commit: ${currentHead}`,
    `- latest tag: ${latestTag}`,
    `- GitHub Actions: ${actionsStatus}`,
    ``,
    `## 完了作業 (${completedWork.length}件)`,
    completedWork.length > 0 ? completedWork.map(w => `- ${w}`).join('\n') : '- なし',
    ``,
    `## 未コミット作業 (${uncommittedWork.length}件)`,
    uncommittedWork.length > 0 ? uncommittedWork.map(w => `- ${w}`).join('\n') : '- なし',
    ``,
    `## 次推奨アクション`,
    nextRecommendedAction || '(未定)',
    ``,
    `## リスクノート`,
    riskNotes.length > 0 ? riskNotes.map(r => `- ⚠ ${r}`).join('\n') : '- なし',
    ``,
    `## 絶対実行禁止`,
    forbiddenActions.map(f => `- ✗ ${f}`).join('\n'),
    ``,
    `## Claude係長への次プロンプト要約`,
    nextClaudePromptSummary || '(特になし)',
    ``,
    `## Gemini課長フォールバック要約`,
    nextGeminiFallbackSummary || '(Geminiエラー時: Claude係長に切り替え)',
    ``,
    `## 承認状態`,
    humanApprovalStatus
  ].join('\n');
}

function generateHandoff(handoffInput = {}) {
  const {
    currentVersion = 'unknown',
    currentHead = 'unknown',
    latestTag = 'none',
    actionsStatus = 'unknown',
    completedWork = [],
    uncommittedWork = [],
    nextRecommendedAction = '',
    riskNotes = [],
    forbiddenActions = FORBIDDEN_ACTIONS_LIST,
    nextClaudePromptSummary = '',
    nextGeminiFallbackSummary = '',
    humanApprovalStatus = '承認待ちなし',
    tone = TONE_PROFILES.CONCISE,
    session_id = ''
  } = handoffInput;

  const data = {
    currentVersion,
    currentHead,
    latestTag,
    actionsStatus,
    completedWork,
    uncommittedWork,
    nextRecommendedAction,
    riskNotes,
    forbiddenActions,
    nextClaudePromptSummary,
    nextGeminiFallbackSummary,
    humanApprovalStatus
  };

  const conciseNote = generateConciseHandoff(data);
  const detailedNote = generateDetailedHandoff(data);

  const handoffNote = tone === TONE_PROFILES.DETAILED ? detailedNote : conciseNote;

  return {
    generator: 'kosame-handoff-auto-generator',
    session_id,
    tone,
    currentVersion,
    currentHead,
    latestTag,
    actionsStatus,
    completedWork,
    uncommittedWork,
    nextRecommendedAction,
    riskNotes,
    forbiddenActions,
    nextClaudePromptSummary,
    nextGeminiFallbackSummary,
    humanApprovalStatus,
    handoffNote,
    conciseNote,
    detailedNote,
    readyForHandoff: uncommittedWork.length === 0 && !riskNotes.some(r => r.toLowerCase().includes('fail')),
    version: GENERATOR_VERSION,
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateHandoff, GENERATOR_VERSION, TONE_PROFILES, FORBIDDEN_ACTIONS_LIST };

if (require.main === module) {
  const concise = generateHandoff({
    currentVersion: '3.9.0',
    currentHead: 'abc1234',
    latestTag: 'v3.8.0',
    actionsStatus: 'success',
    completedWork: ['v3.6.0 CLI Runner実装', 'v3.7.0 Real Repo Snapshot実装', 'v3.8.0 Approval Board実装'],
    uncommittedWork: [],
    nextRecommendedAction: 'npm run verify && git add tools/ smoke/ && git commit -m "feat: v3.9.0"',
    riskNotes: ['Geminiエラー継続中'],
    nextClaudePromptSummary: 'v4.0.0 Practical Operating Console実装を依頼',
    humanApprovalStatus: 'git push/tag承認待ち',
    tone: 'concise'
  });
  console.log(concise.handoffNote);
  console.log('\n---\n');
  const detailed = generateHandoff({ ...concise, tone: 'detailed' });
  console.log(detailed.handoffNote);
}
