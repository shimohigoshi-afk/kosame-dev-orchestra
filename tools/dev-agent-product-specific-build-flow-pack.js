'use strict';

const TOOL_META = {
  version: '57.0.0',
  title:   'KOSAME Dev Orchestra Product-Specific Build Flow Pack',
  slug:    'dev-agent-product-specific-build-flow-pack'
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
  'git add', 'git commit', 'git push', 'git tag',
  'git reset --hard', 'git clean -f',
  'deploy', 'docker build', 'gcloud deploy', 'gcloud run deploy',
  'rm -rf', 'cat .env', 'printenv', 'cat secrets'
];

const BUILD_FLOWS = {
  discord_ai_board: {
    productType:      'discord_ai_board',
    productName:      'ANESTY Board',
    defaultRepoPolicy: 'docs / smoke / fixture / routing changes are low-risk; bot.js / BOARD_CANON.js / Webhook token / deploy are gates',
    allowedTaskTypes:  ['docs_update', 'smoke_addition', 'readme_update', 'runbook_update', 'routing_smoke', 'acceptance_gate_update'],
    forbiddenTaskTypes: ['bot_logic_edit', 'webhook_token_change', 'production_deploy', 'secret_access', 'customer_data_access'],
    recommendedAgents:  ['Claude / Kuro', 'KOSAME / GPT'],
    verificationCommands: ['node --check', 'npm run verify', 'git status --short'],
    acceptanceCriteria: [
      'npm run verify PASS',
      'changed files are docs/** or smoke/** only (for low-risk tasks)',
      'bot.js / BOARD_CANON.js unchanged',
      'no secret / .env touched',
      'no deploy triggered'
    ],
    externalReviewTriggers: ['Webhook / token design change', 'Production deploy', 'Discord permission change'],
    productionGateRequired: true,
    humanApprovalRequired:  true,
    rollbackPolicy:         'git checkout -- <file> (human only)',
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    forbiddenCommands:      FORBIDDEN_COMMANDS_ALWAYS
  },
  sales_dx_pipeline: {
    productType:      'sales_dx_pipeline',
    productName:      '営業DX',
    defaultRepoPolicy: 'Customer/insurance/PII data is critical-gate; docs / dryRun / smoke / prompt template are low-risk',
    allowedTaskTypes:  ['docs_update', 'smoke_addition', 'prompt_template_update', 'dry_run_flow', 'handoff_doc_update'],
    forbiddenTaskTypes: ['customer_data_access', 'insurance_data_access', 'gmail_send', 'gcs_write', 'cloud_tasks_invoke', 'gemini_live_api_call', 'pii_file_access'],
    recommendedAgents:  ['Claude / Kuro', 'KOSAME / GPT', 'External SE (for data boundary)'],
    verificationCommands: ['node --check', 'npm run verify', 'git status --short'],
    acceptanceCriteria: [
      'npm run verify PASS',
      'no customer / insurance data accessed',
      'no real Gmail / GCS / Cloud Tasks triggered',
      'data boundary confirmed by KOSAME/GPT',
      'no PII in logs or docs'
    ],
    externalReviewTriggers: ['Any access to customer/insurance/PII data', 'Real API calls to Gemini / Gmail / GCS', 'Production deploy'],
    productionGateRequired: true,
    humanApprovalRequired:  true,
    rollbackPolicy:         'Revert changed files (human only); data rollback requires external SE review',
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    forbiddenCommands:      FORBIDDEN_COMMANDS_ALWAYS
  },
  backoffice_agent: {
    productType:      'backoffice_agent',
    productName:      'BackOffice Agent',
    defaultRepoPolicy: 'Task classification / routing / template are low-risk; tax/legal/labor judgments and contract send are gates',
    allowedTaskTypes:  ['docs_update', 'smoke_addition', 'task_classification_template', 'routing_policy_update', 'handoff_doc_update'],
    forbiddenTaskTypes: ['tax_judgment', 'legal_judgment', 'labor_judgment', 'contract_send', 'invoice_send', 'pii_access'],
    recommendedAgents:  ['Claude / Kuro', 'KOSAME / GPT'],
    verificationCommands: ['node --check', 'npm run verify', 'git status --short'],
    acceptanceCriteria: [
      'npm run verify PASS',
      'no tax / legal / labor judgment made by AI',
      'no contract / invoice send triggered',
      'no PII accessed'
    ],
    externalReviewTriggers: ['Any legal / tax / labor judgment', 'Contract send', 'Access to financial/PII data'],
    productionGateRequired: true,
    humanApprovalRequired:  true,
    rollbackPolicy:         'Revert changed files (human only)',
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    forbiddenCommands:      FORBIDDEN_COMMANDS_ALWAYS
  },
  email_reply_bot: {
    productType:      'email_reply_bot',
    productName:      'Email Reply BOT',
    defaultRepoPolicy: 'Draft generation / tone / template classification are low-risk; real send / Gmail API / PII / attachments are gates',
    allowedTaskTypes:  ['docs_update', 'smoke_addition', 'reply_template_update', 'tone_policy_update', 'handoff_doc_update'],
    forbiddenTaskTypes: ['gmail_api_send', 'real_email_send', 'pii_access', 'attachment_access', 'contact_list_access'],
    recommendedAgents:  ['Claude / Kuro', 'KOSAME / GPT'],
    verificationCommands: ['node --check', 'npm run verify', 'git status --short'],
    acceptanceCriteria: [
      'npm run verify PASS',
      'no real Gmail API send triggered',
      'no PII / contact list accessed',
      'no attachments accessed'
    ],
    externalReviewTriggers: ['Gmail API send gate', 'PII / contact list access', 'Attachment handling design'],
    productionGateRequired: true,
    humanApprovalRequired:  true,
    rollbackPolicy:         'Revert changed files (human only)',
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    forbiddenCommands:      FORBIDDEN_COMMANDS_ALWAYS
  },
  cloud_run_pm_agent: {
    productType:      'cloud_run_pm_agent',
    productName:      'Cloud Run PM Agent',
    defaultRepoPolicy: 'docs / launch checklist / preflight / smoke are low-risk; gcloud deploy / docker build / Secret Manager / IAM are gates',
    allowedTaskTypes:  ['docs_update', 'smoke_addition', 'preflight_update', 'launch_checklist_update', 'handoff_doc_update'],
    forbiddenTaskTypes: ['gcloud_deploy', 'docker_build', 'secret_manager_access', 'iam_change', 'cloud_run_traffic_split'],
    recommendedAgents:  ['Claude / Kuro', 'KOSAME / GPT', 'External SE (for IAM/Secret)'],
    verificationCommands: ['node --check', 'npm run verify', 'git status --short'],
    acceptanceCriteria: [
      'npm run verify PASS',
      'no gcloud deploy / docker build triggered',
      'no Secret Manager accessed',
      'no IAM change made',
      'Cloud Run config unchanged (except docs)'
    ],
    externalReviewTriggers: ['gcloud deploy', 'IAM change', 'Secret Manager binding change', 'Cloud Run service config change'],
    productionGateRequired: true,
    humanApprovalRequired:  true,
    rollbackPolicy:         'Cloud Run rollback via gcloud (human only), confirmed by external SE',
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    forbiddenCommands:      FORBIDDEN_COMMANDS_ALWAYS
  },
  dev_orchestra_core: {
    productType:      'dev_orchestra_core',
    productName:      'KOSAME Dev Orchestra',
    defaultRepoPolicy: 'tools / smoke / fixtures / docs / package.json changes are standard; git add/commit/push/tag/deploy are gates',
    allowedTaskTypes:  ['docs_update', 'smoke_addition', 'tool_addition', 'fixture_addition', 'package_json_update', 'operation_board_update'],
    forbiddenTaskTypes: ['git_ops', 'deploy', 'secret_access', 'env_access', 'destructive_delete'],
    recommendedAgents:  ['Claude / Kuro', 'KOSAME / GPT'],
    verificationCommands: ['node --check', 'npm run verify', 'npm run smoke:*', 'git status --short'],
    acceptanceCriteria: [
      'node --check PASS for all new files',
      'npm run verify PASS',
      'no git add / commit / push / tag executed',
      'no secret / .env accessed',
      'no deploy triggered'
    ],
    externalReviewTriggers: ['Secret Manager integration', 'Cloud Run deploy config change', 'IAM policy change'],
    productionGateRequired: false,
    humanApprovalRequired:  true,
    rollbackPolicy:         'Revert changed files (human only)',
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    forbiddenCommands:      FORBIDDEN_COMMANDS_ALWAYS
  }
};

function getFlow(productType) {
  return BUILD_FLOWS[productType] || null;
}

function buildProductSpecificFlows(opts) {
  opts = opts || {};
  const now         = opts.timestamp || Date.now();
  const buildFlowId = `product-specific-build-flow-${now}`;
  const selectedTypes = opts.productTypes || Object.keys(BUILD_FLOWS);
  const flows = selectedTypes.map(pt => BUILD_FLOWS[pt]).filter(Boolean);

  return {
    buildFlowId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    flowCount:             flows.length,
    flows,
    generatedAt:           new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  BUILD_FLOWS,
  FORBIDDEN_COMMANDS_ALWAYS,
  getFlow,
  buildProductSpecificFlows
};

if (require.main === module) {
  const result = buildProductSpecificFlows({});
  console.log(JSON.stringify(result, null, 2));
}
