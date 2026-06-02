'use strict';

const TOOL_META = {
  version: '19.5.0',
  title: 'Productization Readiness Review Console',
  slug: 'productization-readiness-review-console-pack'
};

const FINAL_DECISION_OPTIONS = ['approve', 'revise', 'reject', 'hold'];

const READINESS_CHECKLIST_SPEC = [
  { key: 'intake_process_defined',         label: 'Intake process defined (v16.5.0)',       required: true },
  { key: 'claude_prompt_builder_ready',    label: 'Claude prompt builder ready (v17.0.0)',  required: true },
  { key: 'safe_edit_planner_ready',        label: 'Safe edit planner ready (v17.5.0)',      required: true },
  { key: 'template_applicator_ready',      label: 'Template applicator ready (v18.0.0)',    required: true },
  { key: 'verification_handoff_ready',     label: 'Verification & handoff ready (v18.5.0)', required: true },
  { key: 'release_candidate_builder_ready', label: 'Release candidate builder ready (v19.0.0)', required: true },
  { key: 'secret_boundary_defined',        label: 'Secret boundary defined for all products', required: true },
  { key: 'customer_data_boundary_defined', label: 'Customer data boundary defined for all products', required: true },
  { key: 'human_approval_gate_present',    label: 'Human approval gate present in all flows', required: true },
  { key: 'provider_role_map_defined',      label: 'Provider role map defined', required: true },
  { key: 'rollback_procedure_defined',     label: 'Rollback procedure defined for all products', required: true },
  { key: 'no_auto_deploy',                 label: 'No automated deploy in any flow', required: true },
  { key: 'dry_run_mode_enforced',          label: 'dryRun: true enforced in all packs', required: true },
  { key: 'supported_products_min_5',       label: 'At least 5 product types supported', required: true }
];

function buildReadinessChecklist(input) {
  const checks = input.checks || {};
  return READINESS_CHECKLIST_SPEC.map(spec => ({
    key:      spec.key,
    label:    spec.label,
    required: spec.required,
    passed:   checks[spec.key] !== false
  }));
}

function collectBlockers(checklist) {
  return checklist.filter(c => c.required && !c.passed).map(c => c.label);
}

function collectMissingItems(checklist) {
  return checklist.filter(c => !c.passed).map(c => c.label);
}

function determineFinalDecision(blockers, missingItems, safeToPrototype) {
  if (blockers.length > 0)      return 'hold';
  if (missingItems.length > 2)  return 'revise';
  if (!safeToPrototype)         return 'revise';
  return 'approve';
}

function buildReadinessReview(input) {
  const reviewId      = `readiness-review-${Date.now()}`;
  const productType   = String(input.productType || 'all');
  const overrideDecision = input.overrideDecision;

  const productizationChecklist = buildReadinessChecklist(input);
  const blockerItems   = collectBlockers(productizationChecklist);
  const missingItems   = collectMissingItems(productizationChecklist);
  const allRequired    = productizationChecklist.filter(c => c.required).every(c => c.passed);
  const safeToPrototype = blockerItems.length === 0;

  const finalDecision = overrideDecision || determineFinalDecision(blockerItems, missingItems, safeToPrototype);

  const notReadyReasons = [
    ...blockerItems.map(b => `BLOCKER: ${b}`),
    ...missingItems.filter(m => !blockerItems.includes(m)).map(m => `MISSING: ${m}`)
  ];

  const nextActions = (() => {
    if (finalDecision === 'approve') {
      return [
        'Productization readiness confirmed.',
        'Proceed to Productization Prototype Pack (v20.0.0).',
        'Present to じゅんやさん for final YES.'
      ];
    }
    if (finalDecision === 'hold') {
      return blockerItems.map(b => `Resolve blocker: ${b}`);
    }
    return missingItems.slice(0, 3).map(m => `Address: ${m}`);
  })();

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    readinessReviewId:   reviewId,
    productType,
    productizationChecklist,
    allRequiredPassed:   allRequired,
    missingItems,
    blockerItems,
    safeToPrototype,
    notReadyReasons,
    nextActions,
    finalDecision,
    finalDecisionOptions: FINAL_DECISION_OPTIONS,
    noRealExecution:     true
  };
}

function main() {
  console.log(JSON.stringify(buildReadinessReview({
    productType: 'all',
    checks: {}
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  FINAL_DECISION_OPTIONS,
  READINESS_CHECKLIST_SPEC,
  buildReadinessReview
};
