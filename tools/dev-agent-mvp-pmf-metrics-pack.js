'use strict';

const TOOL_META = {
  version: '64.0.0',
  title:   'KOSAME Dev Orchestra MVP / PMF Metrics Pack',
  slug:    'dev-agent-mvp-pmf-metrics-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real ad launch',
  'real LP publish',
  'real payment processing',
  'real user data collection'
];

const THRESHOLDS = {
  cvr: {
    strong:   { value: 0.02, label: 'strong', note: 'CVR 2〜3%以上: 強い価値提供シグナル' },
    signal:   { value: 0.01, label: 'signal', note: 'CVR 1%以上: 価値提供の初期シグナル' },
    weak:     { value: 0,    label: 'weak',   note: 'CVR 0%(十分な母数あり): PIVOT検討' }
  },
  retention30d: {
    pmf:      { value: 0.15, label: 'pmf_candidate', note: '30日継続率15%以上: PMF候補シグナル' },
    low:      { value: 0,    label: 'low',            note: '30日継続率15%未満: 改善またはHOLD' }
  },
  pmfSurvey: {
    strong:   { value: 0.40, label: 'pmf_candidate', note: '「なくなったら非常に残念」40%以上: PMF候補' },
    moderate: { value: 0.20, label: 'moderate',      note: '20〜40%: 改善余地あり' },
    weak:     { value: 0,    label: 'weak',           note: '20%未満: PIVOT/大幅改善が必要' }
  },
  paidConversion: {
    strong:   { threshold: '300DL中1件以上の課金', note: '初期価値あり' },
    pivot:    { threshold: '100〜200DL中課金0件',  note: 'PIVOT検討' }
  }
};

function classifyLtvCac(ltv, cac) {
  if (ltv === null || ltv === undefined || cac === null || cac === undefined) {
    return { status: 'unknown', note: 'LTV/CAC未計測 — データが揃ってから判断する' };
  }
  if (cac === 0) return { status: 'organic', note: 'CAC=0 (オーガニック): コスト面は優位。継続率・LTVを確認。' };
  const ratio = ltv / cac;
  if (ratio >= 3)  return { status: 'healthy',   note: `LTV/CAC = ${ratio.toFixed(1)}: 健全。SCALE/CONTINUE候補。` };
  if (ratio >= 1)  return { status: 'marginal',  note: `LTV/CAC = ${ratio.toFixed(1)}: ギリギリ。改善余地あり。` };
  return             { status: 'unsustainable', note: `LTV/CAC = ${ratio.toFixed(1)}: 持続困難。HOLD/改善が必要。` };
}

function buildMvpPmfMetrics(opts) {
  opts = opts || {};
  const now             = opts.timestamp || Date.now();
  const mvpPmfMetricsId = `mvp-pmf-metrics-${now}`;

  const ltv = opts.ltv !== undefined ? opts.ltv : null;
  const cac = opts.cac !== undefined ? opts.cac : null;
  const ltvCacStatus = classifyLtvCac(ltv, cac);

  const cvr = opts.cvr !== undefined ? opts.cvr : null;
  let cvrStatus = 'unknown';
  if (cvr !== null) {
    if (cvr >= 0.02)     cvrStatus = 'strong';
    else if (cvr >= 0.01) cvrStatus = 'signal';
    else                  cvrStatus = 'weak';
  }

  const retention30d = opts.retention30d !== undefined ? opts.retention30d : null;
  const retentionStatus = retention30d === null ? 'unknown'
    : retention30d >= 0.15 ? 'pmf_candidate' : 'low';

  const pmfSignalScore = opts.pmfSurveyScore !== undefined ? opts.pmfSurveyScore : null;
  const pmfSurveyStatus = pmfSignalScore === null ? 'unknown'
    : pmfSignalScore >= 0.40 ? 'pmf_candidate'
    : pmfSignalScore >= 0.20 ? 'moderate' : 'weak';

  return {
    mvpPmfMetricsId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    productIdea: opts.productIdea || '(未設定)',

    mvpScope: opts.mvpScope || [
      'core機能1つのみ (waitlist → β登録ユーザー向けMVP)',
      'UIは最低限。デザインへの投資はPMF確認後',
      '決済・課金は最小実装 (なければStripe基本プラン等)',
      '分析はGA4 + Mixpanel基本程度から開始'
    ],

    requiredAnalytics: opts.requiredAnalytics || [
      'GA4 (PV / CVR / 離脱ポイント)',
      'Mixpanel / Amplitude (機能利用率 / リテンション)',
      '課金ツール (Stripe等のイベントログ)',
      'アンケート (「なくなったら非常に残念?」 Sean Ellis式)',
      'NPS (Net Promoter Score)'
    ],

    cvr,
    cvrStatus,
    cvrThresholds: THRESHOLDS.cvr,
    cvrNote: cvrStatus === 'strong' ? '強いシグナル。BUILD/SCALE候補。'
           : cvrStatus === 'signal' ? '初期シグナルあり。継続して改善。'
           : cvrStatus === 'weak'   ? '十分な母数あり→PIVOT検討。母数不足→検証継続。'
           : 'CVR未計測。先にデータを取る。',

    retention30d,
    retentionStatus,
    retentionThresholds: THRESHOLDS.retention30d,

    activationRate: opts.activationRate !== undefined ? opts.activationRate : null,
    paidConversion: opts.paidConversion || { actual: null, threshold: THRESHOLDS.paidConversion },

    ltv,
    cac,
    ltvCacStatus,

    qualitativeSignals: opts.qualitativeSignals || [
      '「なくなったら非常に残念」回答率 (PMFサーベイ)',
      'SNSでの自発的な言及・シェア数',
      'カスタマーサポートへの「もっと○○したい」系リクエスト',
      '知人紹介・バイラル行動の発生'
    ],

    pmfSignals: opts.pmfSignals || [
      `PMFサーベイ40%以上: ${THRESHOLDS.pmfSurvey.strong.note}`,
      `30日継続率15%以上: ${THRESHOLDS.retention30d.pmf.note}`,
      'LTV/CAC ≥ 3: 健全な経済性',
      '自発的な口コミ・SNS言及の増加'
    ],

    pmfSurveyScore:   pmfSignalScore,
    pmfSurveyStatus,

    pivotSignals: opts.pivotSignals || [
      `CVR 0% (十分な母数あり): ${THRESHOLDS.cvr.weak.note}`,
      `30日継続率15%未満 かつ 課金0: PIVOT検討`,
      `LTV ≤ CAC: 改善またはHOLD`,
      `100〜200DL中課金0: ${THRESHOLDS.paidConversion.pivot.threshold}`,
      'AI利用料・インフラ費・DB費がLTVを超えている場合'
    ],

    aiInfrastructureCostNote: opts.aiInfrastructureCostNote || [
      'AI利用料 (Gemini / Claude API) はLTV/CAC計算に必ず含める',
      'Cloud Run / Firestore / GCS などのインフラ費もCACに算入する',
      'DB費・メンテナンスコストもLTV判断に含める',
      '数字は業種・規模により大きく変動するため、hard guaranteeにはしない'
    ],

    updateLoopPlan: opts.updateLoopPlan || [
      'Week 1-2: MVPリリース → 初期ユーザーフィードバック収集',
      'Week 3-4: CVR / 離脱ポイント分析 → 最優先改善1点を実装',
      'Week 5-8: リテンション計測 → PMFサーベイ実施',
      'Week 8以降: LTV/CAC判断 → SCALE or PIVOT決定'
    ],

    thresholds: THRESHOLDS,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  THRESHOLDS,
  classifyLtvCac,
  buildMvpPmfMetrics
};

if (require.main === module) {
  const result = buildMvpPmfMetrics({ productIdea: 'AI議事録自動化ツール', cvr: 0.015, retention30d: 0.20 });
  console.log(JSON.stringify(result, null, 2));
}
