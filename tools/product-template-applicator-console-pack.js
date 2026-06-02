'use strict';

const TOOL_META = {
  version: '18.0.0',
  title: 'Product Template Applicator Console',
  slug: 'product-template-applicator-console-pack'
};

const PRODUCT_TEMPLATES = {
  sales_dx: {
    label:            '営業DX',
    recommendedFiles: [
      'docs/spec/feature-spec.md',
      'src/leads/csv-export.js',
      'tests/leads/csv-export.test.js',
      'docs/release/release-notes.md'
    ],
    requiredSmoke:    ['smoke:leads-feature', 'smoke:integration'],
    runbookDraft:     '1. Review feature spec\n2. Implement in src/leads/\n3. Add tests\n4. Run npm verify\n5. Handoff to Kosame PM',
    launchChecklist:  [
      'Feature spec reviewed by こさめ',
      'Implementation reviewed by Claude',
      'Tests passing (npm verify)',
      'Release notes drafted',
      'じゅんやさん final YES'
    ],
    ownerRoles: { pm: 'こさめ/GPT', impl: 'Claude', review: 'Gemini', finalApproval: 'じゅんやさん' }
  },
  anesty_board: {
    label:            'ANESTY Board',
    recommendedFiles: [
      'docs/spec/board-ui-spec.md',
      'src/board/component.js',
      'tests/board/component.test.js',
      'docs/release/release-notes.md'
    ],
    requiredSmoke:    ['smoke:board-ui', 'smoke:integration'],
    runbookDraft:     '1. Review board UI spec\n2. Implement component\n3. Add tests\n4. Security review (no health/insurance data)\n5. Handoff to Kosame PM',
    launchChecklist:  [
      'Board UI spec reviewed',
      'No health/insurance PII in code',
      'Implementation reviewed by Claude',
      'Tests passing',
      'じゅんやさん final YES'
    ],
    ownerRoles: { pm: 'こさめ/GPT', impl: 'Claude', review: 'Gemini', finalApproval: 'じゅんやさん' }
  },
  backoffice_agent: {
    label:            'BackOffice Agent',
    recommendedFiles: [
      'docs/spec/agent-capability-spec.md',
      'src/agents/handler.js',
      'tests/agents/handler.test.js',
      'docs/release/release-notes.md'
    ],
    requiredSmoke:    ['smoke:agent-handler', 'smoke:integration'],
    runbookDraft:     '1. Define agent capability spec\n2. Implement handler\n3. Add tests\n4. No financial/employee PII check\n5. Handoff to Kosame PM',
    launchChecklist:  [
      'Agent capability spec reviewed',
      'No financial/employee PII in code',
      'Tests passing',
      'じゅんやさん final YES'
    ],
    ownerRoles: { pm: 'こさめ/GPT', impl: 'Claude', review: 'Grok', finalApproval: 'じゅんやさん' }
  },
  email_reply_bot: {
    label:            'Email Reply BOT',
    recommendedFiles: [
      'docs/spec/reply-template-spec.md',
      'src/bot/reply-handler.js',
      'src/templates/reply.template.txt',
      'tests/bot/reply-handler.test.js',
      'docs/release/release-notes.md'
    ],
    requiredSmoke:    ['smoke:bot-reply', 'smoke:template'],
    runbookDraft:     '1. Define reply template spec\n2. Implement with mock emails only\n3. No real email credentials\n4. Add tests\n5. Handoff to Kosame PM',
    launchChecklist:  [
      'Template spec reviewed',
      'No real email credentials in code',
      'Mock email tests passing',
      'じゅんやさん final YES'
    ],
    ownerRoles: { pm: 'こさめ/GPT', impl: 'Claude', review: 'Gemini', finalApproval: 'じゅんやさん' }
  },
  cloud_run_pm_agent: {
    label:            'Cloud Run PM Agent',
    recommendedFiles: [
      'tools/<feature>-pack.js',
      'smoke/dev-agent-<feature>-smoke.js',
      'fixtures/<feature>.sample.json',
      'docs/ai-dev-team/<feature>-vX.Y.Z.md',
      'docs/ai-dev-team/kosame-dev-orchestra-vX.Y.Z-release-record.md'
    ],
    requiredSmoke:    ['smoke:<feature>', 'npm run verify'],
    runbookDraft:     '1. Implement in tools/\n2. Add smoke test\n3. Add fixture\n4. Add docs\n5. npm run verify\n6. Handoff to Kosame PM',
    launchChecklist:  [
      'Tool implemented with dryRun: true',
      'Smoke test passing',
      'Fixture present',
      'Docs written',
      'npm run verify PASS',
      'じゅんやさん final YES'
    ],
    ownerRoles: { pm: 'こさめ/GPT', impl: 'Claude', review: 'Gemini', finalApproval: 'じゅんやさん' }
  }
};

const SUPPORTED_PRODUCTS = Object.keys(PRODUCT_TEMPLATES);

function buildTemplateApplicationPacket(input) {
  const templateId  = `template-${Date.now()}`;
  const productType = String(input.productType || 'unknown').toLowerCase();
  const taskGoal    = String(input.taskGoal || '(task goal)').trim();
  const customFiles = input.customFiles || [];

  const template = PRODUCT_TEMPLATES[productType];
  const isKnownProduct = !!template;

  if (!isKnownProduct) {
    return {
      version:    TOOL_META.version,
      title:      TOOL_META.title,
      dryRun:     true,
      humanApprovalRequired: true,
      templateId,
      productType,
      isKnownProduct: false,
      error: `Unknown product "${productType}". Supported: ${SUPPORTED_PRODUCTS.join(', ')}`,
      supportedProducts: SUPPORTED_PRODUCTS
    };
  }

  const recommendedFiles = [...template.recommendedFiles, ...customFiles];

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    templateId,
    productType,
    productLabel:        template.label,
    taskGoal,
    recommendedFiles,
    requiredSmoke:       template.requiredSmoke,
    runbookDraft:        template.runbookDraft,
    launchChecklist:     template.launchChecklist,
    ownerRoles:          template.ownerRoles,
    isKnownProduct:      true,
    supportedProducts:   SUPPORTED_PRODUCTS,
    noRealFileCreation:  true,
    noRealExecution:     true,
    note: 'このpacketは実ファイル作成・commit・push・deployを行わない。じゅんやさんのYES後に進む。'
  };
}

function main() {
  console.log(JSON.stringify(buildTemplateApplicationPacket({
    productType: 'sales_dx',
    taskGoal:    '営業DXリード管理画面にCSVエクスポート機能を追加する'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  PRODUCT_TEMPLATES,
  SUPPORTED_PRODUCTS,
  buildTemplateApplicationPacket
};
