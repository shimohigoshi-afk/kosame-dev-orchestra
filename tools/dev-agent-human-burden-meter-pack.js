'use strict';

const TOOL_META = {
  version: '110.3.0',
  title: 'Human Burden Meter Pack',
  slug: 'dev-agent-human-burden-meter-pack'
};

const BURDEN_BANDS = {
  LOW:       'LOW',
  WATCH:     'WATCH',
  HIGH:      'HIGH',
  TOO_MUCH:  'TOO_MUCH'
};

const BURDEN_WEIGHTS = {
  humanApprovalsRequested: 2,
  copyPasteActions:        3,
  repeatedConfirmations:   4,
  preferenceQuestions:     5,
  manualVerificationSteps: 2,
  chatConsultations:       3,
  repeatedDownloadsSaves:  2,
  unnecessaryDetours:      6
};

const REDUCTION_ACTIONS = {
  HIGH: [
    'compress_confirmations — batch gate items into one YES/NO',
    'use_failure_snapshot — avoid full log transfer',
    'continue_automatically_for_routine_work',
    'defer_non_critical_choices',
    'summarize_only_the_next_action'
  ],
  TOO_MUCH: [
    'compress_confirmations — batch gate items into one YES/NO',
    'use_failure_snapshot — avoid full log transfer',
    'continue_automatically_for_routine_work',
    'defer_non_critical_choices',
    'summarize_only_the_next_action',
    'reset_workflow_to_gate_supervised_autopilot_mode',
    'stop_all_non_gate_asks_immediately'
  ]
};

function measureBurden(input) {
  const {
    humanApprovalsRequested  = 0,
    copyPasteActions         = 0,
    repeatedConfirmations    = 0,
    preferenceQuestions      = 0,
    manualVerificationSteps  = 0,
    chatConsultations        = 0,
    repeatedDownloadsSaves   = 0,
    unnecessaryDetours       = 0,
    dangerGateActive         = false
  } = input || {};

  const raw =
    humanApprovalsRequested  * BURDEN_WEIGHTS.humanApprovalsRequested  +
    copyPasteActions         * BURDEN_WEIGHTS.copyPasteActions         +
    repeatedConfirmations    * BURDEN_WEIGHTS.repeatedConfirmations    +
    preferenceQuestions      * BURDEN_WEIGHTS.preferenceQuestions      +
    manualVerificationSteps  * BURDEN_WEIGHTS.manualVerificationSteps  +
    chatConsultations        * BURDEN_WEIGHTS.chatConsultations        +
    repeatedDownloadsSaves   * BURDEN_WEIGHTS.repeatedDownloadsSaves   +
    unnecessaryDetours       * BURDEN_WEIGHTS.unnecessaryDetours;

  const burdenScore = Math.min(raw, 100);
  const band        = deriveBand(burdenScore);

  const detectedBurdenSources = [];
  if (humanApprovalsRequested  > 0) detectedBurdenSources.push(`human_approvals_requested: ${humanApprovalsRequested}`);
  if (copyPasteActions         > 0) detectedBurdenSources.push(`copy_paste_actions: ${copyPasteActions}`);
  if (repeatedConfirmations    > 0) detectedBurdenSources.push(`repeated_confirmations: ${repeatedConfirmations}`);
  if (preferenceQuestions      > 0) detectedBurdenSources.push(`preference_questions: ${preferenceQuestions}`);
  if (manualVerificationSteps  > 0) detectedBurdenSources.push(`manual_verification_steps: ${manualVerificationSteps}`);
  if (chatConsultations        > 0) detectedBurdenSources.push(`chat_consultations: ${chatConsultations}`);
  if (repeatedDownloadsSaves   > 0) detectedBurdenSources.push(`repeated_downloads_saves: ${repeatedDownloadsSaves}`);
  if (unnecessaryDetours       > 0) detectedBurdenSources.push(`unnecessary_detours: ${unnecessaryDetours}`);

  const recommendedReductionActions =
    band === BURDEN_BANDS.TOO_MUCH ? REDUCTION_ACTIONS.TOO_MUCH :
    band === BURDEN_BANDS.HIGH     ? REDUCTION_ACTIONS.HIGH :
    [];

  const shouldAskUser           = dangerGateActive;
  const shouldProceedAutomatically = !dangerGateActive;
  const humanApprovalRequired   = dangerGateActive;

  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    dryRun: true,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    burdenScore,
    burdenBand: band,
    detectedBurdenSources,
    recommendedReductionActions,
    shouldAskUser,
    shouldProceedAutomatically,
    humanApprovalRequired,
    approvalGatesOnly: true
  };
}

function deriveBand(score) {
  if (score <= 10) return BURDEN_BANDS.LOW;
  if (score <= 25) return BURDEN_BANDS.WATCH;
  if (score <= 50) return BURDEN_BANDS.HIGH;
  return BURDEN_BANDS.TOO_MUCH;
}

function main() {
  const result = measureBurden({
    humanApprovalsRequested: 0,
    chatConsultations: 0,
    dangerGateActive: false
  });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  BURDEN_BANDS,
  BURDEN_WEIGHTS,
  REDUCTION_ACTIONS,
  measureBurden,
  deriveBand
};
