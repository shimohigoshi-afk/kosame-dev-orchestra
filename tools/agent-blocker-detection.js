/**
 * Agent Blocker Detection v2.3.0
 *
 * Classifies blockers: quota, auth, timeout, permission wait,
 * verify failure, Actions failure, etc.
 */

const BLOCKER_CATEGORIES = {
  GEMINI_QUOTA: 'gemini_quota_exhausted',
  GEMINI_AUTH: 'gemini_auth_error',
  GEMINI_TIMEOUT: 'gemini_timeout',
  GEMINI_CONFIRMATION: 'gemini_confirmation_stopped',
  GEMINI_NO_SHELL: 'gemini_shell_tool_missing',
  CLAUDE_TOOL_ERROR: 'claude_tool_error',
  VERIFY_FAILURE: 'verify_failure',
  ACTIONS_FAILURE: 'github_actions_failure',
  PERMISSION_WAIT: 'permission_wait',
  CLOUD_SHELL_UNAVAILABLE: 'cloud_shell_unavailable',
  UNKNOWN: 'unknown'
};

const BLOCKER_SIGNATURES = [
  { pattern: /quota.*exhausted|exhausted.*quota|QUOTA_EXHAUSTED/i, category: 'GEMINI_QUOTA' },
  { pattern: /metadata server|application default credentials|refresh_token|auth.*error|credential/i, category: 'GEMINI_AUTH' },
  { pattern: /timeout|no response|10.*min/i, category: 'GEMINI_TIMEOUT' },
  { pattern: /confirmation|confirm|停止|確認/i, category: 'GEMINI_CONFIRMATION' },
  { pattern: /shell.*tool|tool.*missing|実行.*不可/i, category: 'GEMINI_NO_SHELL' },
  { pattern: /permission|approve|deny|許可/i, category: 'PERMISSION_WAIT' },
  { pattern: /actions.*fail|workflow.*fail|CI.*fail/i, category: 'ACTIONS_FAILURE' },
  { pattern: /verify.*fail|smoke.*fail/i, category: 'VERIFY_FAILURE' },
  { pattern: /cloud.*shell.*unavailable|cloud shell/i, category: 'CLOUD_SHELL_UNAVAILABLE' },
  { pattern: /tool.*error|execution.*error/i, category: 'CLAUDE_TOOL_ERROR' }
];

function detectBlocker(errorText = '') {
  if (!errorText) return { category: 'UNKNOWN', blocker_type: BLOCKER_CATEGORIES.UNKNOWN, severity: 'low', recommended_action: 'investigate' };

  for (const sig of BLOCKER_SIGNATURES) {
    if (sig.pattern.test(errorText)) {
      return classifyBlocker(sig.category, errorText);
    }
  }
  return classifyBlocker('UNKNOWN', errorText);
}

function classifyBlocker(category, raw_error = '') {
  const type = BLOCKER_CATEGORIES[category] || BLOCKER_CATEGORIES.UNKNOWN;

  const severityMap = {
    GEMINI_QUOTA: 'medium',
    GEMINI_AUTH: 'high',
    GEMINI_TIMEOUT: 'medium',
    GEMINI_CONFIRMATION: 'medium',
    GEMINI_NO_SHELL: 'medium',
    CLAUDE_TOOL_ERROR: 'medium',
    VERIFY_FAILURE: 'high',
    ACTIONS_FAILURE: 'high',
    PERMISSION_WAIT: 'low',
    CLOUD_SHELL_UNAVAILABLE: 'medium',
    UNKNOWN: 'low'
  };

  const actionMap = {
    GEMINI_QUOTA: 'fallback_to_claude',
    GEMINI_AUTH: 'fallback_to_claude_immediately',
    GEMINI_TIMEOUT: 'retry_once_then_fallback',
    GEMINI_CONFIRMATION: 'fallback_to_claude',
    GEMINI_NO_SHELL: 'fallback_to_claude',
    CLAUDE_TOOL_ERROR: 'retry_claude_with_clarification',
    VERIFY_FAILURE: 'claude_repair_mode',
    ACTIONS_FAILURE: 'actions_failure_triage',
    PERMISSION_WAIT: 'generate_approval_packet',
    CLOUD_SHELL_UNAVAILABLE: 'escalate_to_human',
    UNKNOWN: 'investigate'
  };

  const geminiBlockers = ['GEMINI_QUOTA', 'GEMINI_AUTH', 'GEMINI_TIMEOUT', 'GEMINI_CONFIRMATION', 'GEMINI_NO_SHELL'];

  return {
    category,
    blocker_type: type,
    severity: severityMap[category] || 'low',
    recommended_action: actionMap[category] || 'investigate',
    is_gemini_blocker: geminiBlockers.includes(category),
    requires_human: ['ACTIONS_FAILURE', 'CLOUD_SHELL_UNAVAILABLE'].includes(category),
    raw_error_snippet: raw_error.slice(0, 200),
    version: '2.3.0',
    detected_at: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { detectBlocker, classifyBlocker, BLOCKER_CATEGORIES, BLOCKER_SIGNATURES };

if (require.main === module) {
  const errors = [
    'metadata server application default credentials error',
    'QUOTA_EXHAUSTED: daily limit reached',
    'npm run verify: 3 FAILED',
    'GitHub Actions workflow failed on CI'
  ];
  errors.forEach(e => {
    const result = detectBlocker(e);
    console.log(`[${result.blocker_type}] ${e.slice(0, 50)} → ${result.recommended_action}`);
  });
}
