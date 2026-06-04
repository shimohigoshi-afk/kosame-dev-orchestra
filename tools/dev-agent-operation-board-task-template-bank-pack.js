'use strict';

const TOOL_META = {
  version: '49.0.0',
  title:   'KOSAME Dev Orchestra Operation Board Task Template Bank Pack',
  slug:    'dev-agent-operation-board-task-template-bank-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)'
];

const FORBIDDEN_COMMANDS_ALWAYS = [
  'git add',
  'git commit',
  'git push',
  'git tag',
  'git reset --hard',
  'git clean -f',
  'git checkout -- .',
  'deploy',
  'docker build',
  'gcloud deploy',
  'gcloud run deploy',
  'npm run deploy',
  'rm -rf',
  'cat .env',
  'cat secrets',
  'printenv'
];

const VERIFICATION_COMMANDS_ALWAYS = [
  'node --check <file>',
  'npm run verify',
  'git status --short',
  'git log --oneline -5'
];

const TASK_TEMPLATES = [
  {
    templateId:           'docs_update',
    title:                'docs更新 (ai-dev-team/*.md)',
    productType:          'kosame-dev-orchestra',
    recommendedAgent:     'Claude / Kuro',
    allowedFiles:         ['docs/ai-dev-team/*.md', 'docs/smoke-records/*.md'],
    forbiddenFiles:       ['.env', 'secrets/**', 'node_modules/**', '*.key', 'credentials/**'],
    allowedCommands:      ['node --check', 'npm run verify', 'git status --short', 'git log --oneline'],
    forbiddenCommands:    FORBIDDEN_COMMANDS_ALWAYS,
    verificationCommands: VERIFICATION_COMMANDS_ALWAYS,
    dangerGates:          { secretRead: 'BLOCKED', envRead: 'BLOCKED', deploy: 'BLOCKED', gitPushByAI: 'BLOCKED', customerDataRead: 'BLOCKED', destructiveDelete: 'BLOCKED' },
    humanApprovalRequired: true,
    expectedChangedFiles: ['docs/ai-dev-team/<new-doc>.md'],
    doneCriteria:         ['npm run verify PASS', 'changed files are docs/** only', 'no secret/env touched'],
    rollbackInstruction:  'git checkout -- docs/<file> (human only)',
    commitStopRule:       'Stop before git add. Human/じゅんやさん YES required.'
  },
  {
    templateId:           'smoke_addition',
    title:                '新smokeテスト追加',
    productType:          'kosame-dev-orchestra',
    recommendedAgent:     'Claude / Kuro',
    allowedFiles:         ['tools/*.js', 'smoke/*.js', 'fixtures/*.json', 'docs/ai-dev-team/*.md', 'package.json'],
    forbiddenFiles:       ['.env', 'secrets/**', 'node_modules/**'],
    allowedCommands:      ['node --check', 'npm run verify', 'npm run smoke:*', 'git status --short'],
    forbiddenCommands:    FORBIDDEN_COMMANDS_ALWAYS,
    verificationCommands: ['node --check <tool>', 'node --check <smoke>', 'npm run smoke:<name>', 'npm run verify'],
    dangerGates:          { secretRead: 'BLOCKED', envRead: 'BLOCKED', deploy: 'BLOCKED', gitPushByAI: 'BLOCKED', customerDataRead: 'BLOCKED', destructiveDelete: 'BLOCKED' },
    humanApprovalRequired: true,
    expectedChangedFiles: ['tools/<new-tool>.js', 'smoke/<new-smoke>.js', 'fixtures/<new>.fixture.json', 'package.json'],
    doneCriteria:         ['node --check PASS', 'npm run smoke:<name> PASS', 'npm run verify PASS'],
    rollbackInstruction:  'Remove new files, revert package.json (human only)',
    commitStopRule:       'Stop before git add. Human/じゅんやさん YES required.'
  },
  {
    templateId:           'readme_update',
    title:                'README.md更新',
    productType:          'kosame-dev-orchestra',
    recommendedAgent:     'Claude / Kuro',
    allowedFiles:         ['README.md', 'docs/**/*.md'],
    forbiddenFiles:       ['.env', 'secrets/**', 'node_modules/**'],
    allowedCommands:      ['git status --short', 'npm run verify'],
    forbiddenCommands:    FORBIDDEN_COMMANDS_ALWAYS,
    verificationCommands: ['git status --short', 'npm run verify'],
    dangerGates:          { secretRead: 'BLOCKED', envRead: 'BLOCKED', deploy: 'BLOCKED', gitPushByAI: 'BLOCKED', customerDataRead: 'BLOCKED', destructiveDelete: 'BLOCKED' },
    humanApprovalRequired: true,
    expectedChangedFiles: ['README.md'],
    doneCriteria:         ['npm run verify PASS', 'only README.md / docs changed'],
    rollbackInstruction:  'git checkout -- README.md (human only)',
    commitStopRule:       'Stop before git add. Human/じゅんやさん YES required.'
  },
  {
    templateId:           'runbook_update',
    title:                'runbook更新 (docs/ai-dev-team/)',
    productType:          'kosame-dev-orchestra',
    recommendedAgent:     'Claude / Kuro',
    allowedFiles:         ['docs/ai-dev-team/*.md'],
    forbiddenFiles:       ['.env', 'secrets/**', 'node_modules/**', 'bot.js', 'BOARD_CANON.js'],
    allowedCommands:      ['git status --short', 'npm run verify'],
    forbiddenCommands:    FORBIDDEN_COMMANDS_ALWAYS,
    verificationCommands: ['git status --short', 'npm run verify'],
    dangerGates:          { secretRead: 'BLOCKED', envRead: 'BLOCKED', deploy: 'BLOCKED', gitPushByAI: 'BLOCKED', customerDataRead: 'BLOCKED', destructiveDelete: 'BLOCKED' },
    humanApprovalRequired: true,
    expectedChangedFiles: ['docs/ai-dev-team/<runbook>.md'],
    doneCriteria:         ['npm run verify PASS', 'only docs changed'],
    rollbackInstruction:  'git checkout -- docs/<file> (human only)',
    commitStopRule:       'Stop before git add. Human/じゅんやさん YES required.'
  },
  {
    templateId:           'cloudrun_preflight_update',
    title:                'Cloud Run preflight pack更新',
    productType:          'kosame-dev-orchestra',
    recommendedAgent:     'Claude / Kuro',
    allowedFiles:         ['tools/pm-agent-cloud-run-preflight.js', 'smoke/**-preflight-smoke.js', 'fixtures/**-preflight.*.json', 'docs/ai-dev-team/*.md'],
    forbiddenFiles:       ['.env', 'secrets/**', 'node_modules/**', 'cloud-run/*.yaml'],
    allowedCommands:      ['node --check', 'npm run verify', 'git status --short'],
    forbiddenCommands:    FORBIDDEN_COMMANDS_ALWAYS,
    verificationCommands: ['node --check <tool>', 'npm run verify'],
    dangerGates:          { secretRead: 'BLOCKED', envRead: 'BLOCKED', deploy: 'BLOCKED', gitPushByAI: 'BLOCKED', customerDataRead: 'BLOCKED', destructiveDelete: 'BLOCKED' },
    humanApprovalRequired: true,
    expectedChangedFiles: ['tools/pm-agent-cloud-run-preflight.js', 'docs/ai-dev-team/*.md'],
    doneCriteria:         ['node --check PASS', 'npm run verify PASS', 'no actual deploy triggered'],
    rollbackInstruction:  'Revert tool file (human only)',
    commitStopRule:       'Stop before git add. Human/じゅんやさん YES required.'
  },
  {
    templateId:           'acceptance_gate_update',
    title:                'Acceptance Gate pack更新',
    productType:          'kosame-dev-orchestra',
    recommendedAgent:     'Claude / Kuro',
    allowedFiles:         ['tools/*acceptance*.js', 'smoke/*acceptance*.js', 'fixtures/*acceptance*.json', 'docs/ai-dev-team/*.md', 'package.json'],
    forbiddenFiles:       ['.env', 'secrets/**', 'node_modules/**'],
    allowedCommands:      ['node --check', 'npm run verify', 'git status --short'],
    forbiddenCommands:    FORBIDDEN_COMMANDS_ALWAYS,
    verificationCommands: ['node --check <file>', 'npm run verify'],
    dangerGates:          { secretRead: 'BLOCKED', envRead: 'BLOCKED', deploy: 'BLOCKED', gitPushByAI: 'BLOCKED', customerDataRead: 'BLOCKED', destructiveDelete: 'BLOCKED' },
    humanApprovalRequired: true,
    expectedChangedFiles: ['tools/*acceptance*.js', 'package.json'],
    doneCriteria:         ['node --check PASS', 'npm run verify PASS'],
    rollbackInstruction:  'Revert tool and package.json (human only)',
    commitStopRule:       'Stop before git add. Human/じゅんやさん YES required.'
  },
  {
    templateId:           'operation_board_update',
    title:                'Operation Board pack更新',
    productType:          'kosame-dev-orchestra',
    recommendedAgent:     'Claude / Kuro',
    allowedFiles:         ['tools/dev-agent-*operation-board*.js', 'smoke/dev-agent-*operation-board*.js', 'fixtures/*operation-board*.json', 'docs/ai-dev-team/*.md', 'package.json'],
    forbiddenFiles:       ['.env', 'secrets/**', 'node_modules/**'],
    allowedCommands:      ['node --check', 'npm run verify', 'npm run pm-agent:show-operation-board', 'git status --short'],
    forbiddenCommands:    FORBIDDEN_COMMANDS_ALWAYS,
    verificationCommands: ['node --check <file>', 'npm run smoke:practical-operation-board-display', 'npm run verify'],
    dangerGates:          { secretRead: 'BLOCKED', envRead: 'BLOCKED', deploy: 'BLOCKED', gitPushByAI: 'BLOCKED', customerDataRead: 'BLOCKED', destructiveDelete: 'BLOCKED' },
    humanApprovalRequired: true,
    expectedChangedFiles: ['tools/dev-agent-*operation-board*.js', 'package.json'],
    doneCriteria:         ['node --check PASS', 'npm run smoke:practical-operation-board-display PASS', 'npm run verify PASS'],
    rollbackInstruction:  'Revert tool and package.json (human only)',
    commitStopRule:       'Stop before git add. Human/じゅんやさん YES required.'
  },
  {
    templateId:           'product_repo_controlled_task',
    title:                '外部productリポへのcontrolled task実行',
    productType:          'external-product-repo',
    recommendedAgent:     'Claude / Kuro',
    allowedFiles:         ['docs/**/*.md', 'docs/smoke-records/**/*.md'],
    forbiddenFiles:       ['bot.js', 'BOARD_CANON.js', '.env', 'secrets/**', 'node_modules/**', '.github/workflows/**'],
    allowedCommands:      ['node --check', 'npm run verify', 'git status --short', 'git log --oneline -5', 'ls docs/'],
    forbiddenCommands:    FORBIDDEN_COMMANDS_ALWAYS,
    verificationCommands: ['npm run verify', 'git status --short'],
    dangerGates:          { secretRead: 'BLOCKED', envRead: 'BLOCKED', deploy: 'BLOCKED', gitPushByAI: 'BLOCKED', customerDataRead: 'BLOCKED', destructiveDelete: 'BLOCKED' },
    humanApprovalRequired: true,
    expectedChangedFiles: ['docs/ai-dev-team/<new-doc>.md'],
    doneCriteria:         ['npm run verify PASS', 'changed files are docs/** only', 'no bot.js/BOARD_CANON.js touched', 'no secret/env touched', 'no deploy triggered'],
    rollbackInstruction:  'Remove new doc file (human only)',
    commitStopRule:       'Stop before git add. Human/じゅんやさん YES required.'
  },
  {
    templateId:           'handoff_doc_update',
    title:                'Handoff doc更新 (引継ぎドキュメント)',
    productType:          'kosame-dev-orchestra',
    recommendedAgent:     'Claude / Kuro',
    allowedFiles:         ['docs/ai-dev-team/*.md', 'reports/orchestra/*.md'],
    forbiddenFiles:       ['.env', 'secrets/**', 'node_modules/**'],
    allowedCommands:      ['git status --short', 'npm run verify'],
    forbiddenCommands:    FORBIDDEN_COMMANDS_ALWAYS,
    verificationCommands: ['git status --short', 'npm run verify'],
    dangerGates:          { secretRead: 'BLOCKED', envRead: 'BLOCKED', deploy: 'BLOCKED', gitPushByAI: 'BLOCKED', customerDataRead: 'BLOCKED', destructiveDelete: 'BLOCKED' },
    humanApprovalRequired: true,
    expectedChangedFiles: ['docs/ai-dev-team/<handoff>.md'],
    doneCriteria:         ['npm run verify PASS', 'only docs / reports changed'],
    rollbackInstruction:  'Remove new doc (human only)',
    commitStopRule:       'Stop before git add. Human/じゅんやさん YES required.'
  }
];

function getTemplate(templateId) {
  return TASK_TEMPLATES.find(t => t.templateId === templateId) || null;
}

function buildTemplateBank(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  return {
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    templateCount:         TASK_TEMPLATES.length,
    templates:             TASK_TEMPLATES,
    generatedAt:           new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  FORBIDDEN_COMMANDS_ALWAYS,
  TASK_TEMPLATES,
  getTemplate,
  buildTemplateBank
};

if (require.main === module) {
  const bank = buildTemplateBank();
  console.log(JSON.stringify(bank, null, 2));
}
