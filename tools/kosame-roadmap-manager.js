#!/usr/bin/env node
'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const EXECUTOR_DIR = path.join(ROOT, '.kosame-executor');

const ROADMAP = {
  version: '113.3.125',
  generated_at: new Date().toISOString(),
  model_lane: 'L2_DEEPSEEK_V4_PRO',
  confidentiality: 'safe',
  final_arbiter: 'GPT/KOSAME',
  phases: [
    { id:'v113.3.125', phase:'Console Self-Test Full Repair', summary:'Consoleの全機能自己診断と自動修復パスを完成させる。ダッシュボード表示・API疎通・UI要素・css破壊検知を自動判定し、壊れたら理由付きで報告する。', deps:[], model:'deepseek-v4-pro', diff:'medium', conf:'safe', gate:false, audit:false, deliverables:['console self-test runner','auto repair detector','css/js integrity scan'] },
    { id:'v113.3.126', phase:'Console Regression Lock', summary:'Console変更後自動regression smokeを走らせ、既存UI破壊・API破壊・DOM要素消失を検知する。CI/CD類似のguard機構。', deps:['v113.3.125'], model:'deepseek-v4-pro', diff:'medium', conf:'safe', gate:false, deliverables:['dom diff checker','api response shape snapshot','visual regression warning'] },
    { id:'v113.3.127', phase:'Operational Log Watch', summary:'運用ログ取集と異常検知。Real HTTP E2E結果・Field Ops結果・Limit Break結果を集約し、正常値からの逸脱をConsoleで通知する。', deps:['v113.3.126'], model:'deepseek-v4-pro', diff:'medium', conf:'safe', gate:false, deliverables:['log collector','anomaly badge','daily ops digest'] },
    { id:'v113.3.128', phase:'Recovery / Rollback / Safe Restore', summary:'.kosame-executorの生成物リストア・public/test.html canonical復元・git status安全確認・push前完全チェックの自動化。', deps:['v113.3.125'], model:'deepseek-v4-flash', diff:'medium', conf:'safe', gate:false, deliverables:['safe restore script','canonical snapshot compare','pre-push full gate'] },
    { id:'v113.3.129', phase:'RC Freeze', summary:'Release Candidate状態で完全フリーズ。全smoke・ops・verifyを通過した状態でスナップショットを取り、本番投入基準を満たすことを宣言する。', deps:['v113.3.127','v113.3.128'], model:'deepseek-v4-pro', diff:'medium', conf:'safe', gate:false, deliverables:['rc freeze snapshot','baseline integrity hash','freeze declaration'] },
    { id:'v113.3.130', phase:'Documentation / Handoff Pack', summary:'全機能のドキュメント・運用マニュアル・次担当者向けハンドオフpackを生成する。人間が読める形式。', deps:['v113.3.129'], model:'deepseek-v4-pro', diff:'low', conf:'safe', gate:false, deliverables:['dev-orchestra-manual.md','operator-handoff.md','next-dev-handoff.md'] },

    { id:'v113.4.0', phase:'Real Request Auto Simulation', summary:'実人間の依頼を模擬した自動リクエストをConsole経由で投げ、DeepSeek Handoff→Result→Action→Judge→Release Gateを完全自動で走らせるdry-run。', deps:['v113.3.130'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:false, audit:true, deliverables:['auto request simulator','end-to-end console runner','result comparison engine'] },
    { id:'v113.4.1', phase:'Task Vault Runtime Link', summary:'ConsoleのTask Vault（作業候補・Next Action・危険ゲート）をRuntimeロジックと連動させる。Auto Saveと同期し、次にやることがConsoleに常に表示される。', deps:['v113.4.0'], model:'deepseek-v4-pro', diff:'medium', conf:'safe', gate:false, deliverables:['task vault sync','next action live update','danger gate live badge'] },
    { id:'v113.4.2', phase:'Auto Save 50min Lock', summary:'操作から50分経過したら自動セーブ。セッション復元時に前回状態を引き継ぐ。データ喪失防止。', deps:['v113.4.1'], model:'deepseek-v4-pro', diff:'medium', conf:'safe', gate:false, deliverables:['50min auto save','session restore','crash recovery'] },
    { id:'v113.4.3', phase:'Current Mission Restore', summary:'Console再起動時に現在のミッション状態（最新lane/直前のJudge/最新Release Gate）を復元表示する。', deps:['v113.4.2'], model:'deepseek-v4-flash', diff:'medium', conf:'safe', gate:false, deliverables:['mission state restore','lane/judge/gate restore'] },
    { id:'v113.4.4', phase:'Next Action Restore', summary:'前回セッション終了時のNext Actionを復元表示。何をやっていたか即座に思い出せる。', deps:['v113.4.3'], model:'deepseek-v4-flash', diff:'low', conf:'safe', gate:false, deliverables:['next action panel restore','context breadcrumb'] },
    { id:'v113.4.5', phase:'Chat-to-Task Converter', summary:'Consoleのチャット入力から作業票を自動生成する。Natural文→prompt_text→Work Orderへの変換パイプライン。', deps:['v113.4.4'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:false, audit:true, deliverables:['chat-to-task pipeline','prompt sanitizer','work order template filler'] },

    { id:'v113.6.0', phase:'Cost Meter Runtime', summary:'各AIモデルのAPI呼び出しコストをリアルタイムでConsoleに表示する。予算超過時に警告。', deps:['v113.4.5'], model:'deepseek-v4-pro', diff:'medium', conf:'safe', gate:false, deliverables:['cost meter panel','token counter','budget warning'] },
    { id:'v113.6.1', phase:'Provider Cost Breakdown', summary:'DeepSeek / GPT / Gemini / Llama / Groq のプロバイダ別コスト内訳を表示。', deps:['v113.6.0'], model:'deepseek-v4-flash', diff:'low', conf:'safe', gate:false, deliverables:['provider cost chart','monthly trend','provider ranking'] },
    { id:'v113.6.2', phase:'Model Lane Cost Breakdown', summary:'L1 Flash / L2 Pro / L3 Pro+Audit 別のコスト推移を表示。DeepSeek V4のコスト効率を可視化。', deps:['v113.6.1'], model:'deepseek-v4-flash', diff:'low', conf:'safe', gate:false, deliverables:['lane cost breakdown','flash vs pro comparison','audit overhead cost'] },
    { id:'v113.6.3', phase:'High Cost Warning', summary:'1リクエストあたりのコストが閾値を超えたらConsoleに警告バッジを出す。DeepSeek Balance残高連動可能なら連携。', deps:['v113.6.2'], model:'deepseek-v4-pro', diff:'medium', conf:'safe', gate:false, deliverables:['cost warning badge','threshold config','balance alert'] },
    { id:'v113.6.4', phase:'DeepSeek Balance Alert Guide', summary:'DeepSeek残高不足時に代替レーン（V4 Flash / Local Executor）へ自動フォールバックする推奨を出す。', deps:['v113.6.3'], model:'deepseek-v4-flash', diff:'medium', conf:'safe', gate:false, deliverables:['balance checker','fallback recommender','model downgrade guide'] },
    { id:'v113.6.5', phase:'Peak Time Warning', summary:'深夜・週末などAPI速度低下リスクのある時間帯に事前警告を出す。', deps:['v113.6.4'], model:'deepseek-v4-flash', diff:'low', conf:'safe', gate:false, deliverables:['peak time detector','latency forecaster','off-peak scheduler'] },

    { id:'v113.7.0', phase:'Wishlist Lite Runtime', summary:'将来アイデア・あとでやる・思いつきをWishlistとして保存し、Consoleに表示する。', deps:['v113.6.5'], model:'deepseek-v4-pro', diff:'medium', conf:'safe', gate:false, deliverables:['wishlist panel','add wish item','wish priority sort'] },
    { id:'v113.7.1', phase:'Later Ideas Board', summary:'Wishlistのうち「いまじゃないけど価値がある」ものを後回しボードへ移動。', deps:['v113.7.0'], model:'deepseek-v4-flash', diff:'low', conf:'safe', gate:false, deliverables:['later ideas board','drag to later','remind me later'] },
    { id:'v113.7.2', phase:'Suggested After Version', summary:'Wishlistの項目がどのバージョン以降で実装可能か提案する。依存関係を解析。', deps:['v113.7.1'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:false, audit:true, deliverables:['version suggestion engine','dependency resolver','feasibility score'] },
    { id:'v113.7.3', phase:'Smart Suggestion Seed', summary:'Wishlist項目をAIが読み、類似タスクとの重複検知・分割提案・優先度付けの種を生成する。', deps:['v113.7.2'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:false, audit:true, deliverables:['smart grouping','duplicate detector','priority seed'] },

    { id:'v114.0.0', phase:'Cloud Run Readiness', summary:'KOSAME Dev OrchestraをCloud Runへ載せる前準備。Dockerfile最適化、環境変数管理、secret境界設計。', deps:['v113.7.3'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:true, audit:true, deliverables:['cloud run dockerfile','env var manifest','secret boundary design'] },
    { id:'v114.1.0', phase:'Secret Boundary', summary:'Secret Manager統合。.envをCloud Runに持ち上げ、consoleからの鍵露出を防ぐ。', deps:['v114.0.0'], model:'gemini', diff:'high', conf:'sensitive', gate:true, deliverables:['secret manager integration','env migration plan','key rotation schedule'] },
    { id:'v114.2.0', phase:'Auth / Access Control', summary:'Cloud Run版にアクセス制御を追加。IAM role、OAuth、API key管理。', deps:['v114.1.0'], model:'gemini', diff:'high', conf:'sensitive', gate:true, deliverables:['auth layer','iam config','access log'] },
    { id:'v114.3.0', phase:'Production Deploy Gate', summary:'本番デプロイのためのgate完全自動化。human gate + verify PASS + judge accept + rc freeze が揃わない限りdeploy不可。', deps:['v114.2.0'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:true, audit:true, deliverables:['production deploy gate','deploy required checklist','auto gate validator'] },
    { id:'v114.4.0', phase:'Cloud Logging / Monitoring', summary:'Cloud LoggingとMonitoringを接続し、Consoleに運用ログ表示。異常検知。', deps:['v114.3.0'], model:'gemini', diff:'medium', conf:'safe', gate:false, deliverables:['cloud logging panel','alert config','dashboard metrics'] },
    { id:'v114.5.0', phase:'Cost / Alert / Billing Guard', summary:'Cloud Runの使用量モニタリング。設定された予算を超えそうならhuman_gate必須でアラート。', deps:['v114.4.0'], model:'gemini', diff:'medium', conf:'sensitive', gate:true, deliverables:['billing guard','usage alert','auto shutdown threshold'] },

    { id:'v115.0.0', phase:'KOSAME Sales Console Branch', summary:'KOSAME Sales Consoleをブランチ分離。既存repoへの混入を防ぎつつ、専用UI/知識ベースを持つ。', deps:['v114.5.0'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:false, audit:true, deliverables:['fk-omiya branch','fk console router','fk knowledge schema'] },
    { id:'v115.1.0', phase:'Sales Console Knowledge MVP', summary:'営業支援用不動産知識・地域データベースをConsoleで検索・表示できるようにする。', deps:['v115.0.0'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:false, audit:true, deliverables:['knowledge search ui','region filter','property detail view'] },
    { id:'v115.2.0', phase:'Map Touch Knowledge UI', summary:'地図タッチで地域情報を表示。不動産価格・学区・交通をオーバーレイ。', deps:['v115.1.0'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:false, audit:true, deliverables:['map overlay','region data popup','price heatmap'] },

    { id:'v116.0.0', phase:'KOSAME LP Asset Cleanup', summary:'ランディングページ用画像とアセットを整理し、.gitignore/excludeを明確化。', deps:['v115.2.0'], model:'deepseek-v4-flash', diff:'low', conf:'sanitized', gate:false, deliverables:['asset cleanup script','gitignore update','asset manifest'] },
    { id:'v116.4.0', phase:'Security / Pricing / Flow Page', summary:'セキュリティ説明・料金プラン・業務フローをサービスページとして追加。', deps:['v116.0.0'], model:'deepseek-v4-pro', diff:'medium', conf:'safe', gate:false, deliverables:['security page','pricing page','flow diagram'] },

    { id:'v117.0.0', phase:'Sales DX Boundary Design', summary:'営業DXを外部AIに渡さない境界設計。タスクフィルタ、Sanitized Task Pack、Customer Data Guard。', deps:['v116.4.0'], model:'deepseek-v4-pro', diff:'high', conf:'sensitive', gate:true, audit:true, deliverables:['sales dx boundary','task sanitizer','data guard layer'] },
    { id:'v117.3.0', phase:'Sanitized Task Pack Builder', summary:'営業DX / transcriber向けのSanitized Task Packを自動生成する。顧客データ・保険ロジックを含めずに技術タスクだけ抽出。', deps:['v117.0.0'], model:'deepseek-v4-pro', diff:'high', conf:'sensitive', gate:true, deliverables:['sanitized pack generator','data remover','safe task extractor'] },

    { id:'v118.0.0', phase:'KOSAME Company OS Core', summary:'会社全体のOS基盤。全社Task Vault、Memory Vault、Decision Log、Daily Brief。', deps:['v117.3.0'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:false, audit:true, deliverables:['company os panel','org task vault','daily brief generator'] },
    { id:'v118.2.0', phase:'Personal OS', summary:'個人向けOS。個人Task Vault、Gmail/Calendar連携、Daily Brief。', deps:['v118.0.0'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:false, audit:true, deliverables:['personal os panel','gmail link','calendar sync'] },

    { id:'v119.0.0', phase:'Model Lane Router v2', summary:'Model Lane Routerのv2。DeepSeek V4 Flash/Proのコスト分割、Llama/Groq Audit Laneの独立、Gemini Cloud LaneのGCP専用化。', deps:['v118.2.0'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:false, audit:true, deliverables:['router v2','cost splitter','lane optimizer'] },
    { id:'v119.5.0', phase:'GPT Judge Final Arbitration', summary:'GPTによる最終裁定を完全自動化。Judge APIからGPTへ回送し、accept/revise/reject/human_gateの最終決定を返す。', deps:['v119.0.0'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:false, audit:true, deliverables:['gpt judge gateway','arbitration log','fallback to human'] },

    { id:'v120.0.0', phase:'Pricing / Contract Pack', summary:'価格設定・契約テンプレート・見積書自動生成。事業化準備。', deps:['v119.5.0'], model:'deepseek-v4-pro', diff:'medium', conf:'safe', gate:false, deliverables:['pricing model','contract template','quote generator'] },
    { id:'v120.2.0', phase:'Operations Manual', summary:'運用マニュアル。停止・復旧・監視・アラート・エスカレーションの全手順。', deps:['v120.0.0'], model:'deepseek-v4-flash', diff:'low', conf:'safe', gate:false, deliverables:['operations manual','runbook','escalation guide'] },

    { id:'v121.0.0', phase:'外部提供パッケージ', summary:'外部クライアント向け導入パッケージ。テンプレート・説明資料・初期設定手順。', deps:['v120.2.0'], model:'deepseek-v4-pro', diff:'medium', conf:'safe', gate:false, deliverables:['onboarding pack','template set','setup guide'] },
    { id:'v122.0.0', phase:'代理店テンプレート', summary:'保険代理店向けテンプレート群。支店Console、FAQ、地域情報、商品資料。', deps:['v121.0.0'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:false, audit:true, deliverables:['agency template','branch console','faq database'] },
    { id:'v123.0.0', phase:'複数支店展開', summary:'複数支店の同時管理。branch registry、支店別permission、支店別knowledge。', deps:['v122.0.0'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:false, audit:true, deliverables:['multi-branch manager','branch config','permission matrix'] },
    { id:'v124.0.0', phase:'KOSAME SaaS化準備', summary:'マルチテナント設計。user/organization/usage/billing管理。', deps:['v123.0.0'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:false, audit:true, deliverables:['multi-tenant core','org manager','usage tracker'] },
    { id:'v125.0.0', phase:'本格プロダクト化', summary:'SaaSとしての本格リリース。onboarding・support・monitoring・billing・release cycle。', deps:['v124.0.0'], model:'deepseek-v4-pro', diff:'high', conf:'safe', gate:true, audit:true, deliverables:['saas product core','customer portal','release pipeline'] },
  ],
  next_actions: [
    'v113.3.125: Console Self-Test Full Repair',
    'v113.3.126: Console Regression Lock',
    'v113.3.127: Operational Log Watch',
    'v113.3.128: Recovery / Rollback / Safe Restore',
    'v113.3.129: RC Freeze',
  ],
  human_gate_rules: [
    'commit / tag / push / deploy → human gate required',
    'IAM / billing / production → human gate required',
    'Secret / .env / credentials → forbidden for external AI',
    'sales-dx / transcriber → sensitive or forbidden',
    'customer data / insurance logic → sensitive (INTERNAL_ONLY)',
  ],
  model_lane_rules: [
    'L0_LOCAL: simple file append/replace/create',
    'L1_DEEPSEEK_V4_FLASH: safe/sanitized + low difficulty',
    'L2_DEEPSEEK_V4_PRO: safe/sanitized + medium difficulty',
    'L3_DEEPSEEK_V4_PRO_AUDIT: safe/sanitized + high difficulty',
    'INTERNAL_ONLY: sensitive (GPT/こさめ)',
    'BLOCKED: forbidden',
    'DeepSeek V4 = Worker / Audit+Implementation Lane',
    'GPT/こさめ = Final Arbitrator / Commander',
  ],
};

// Generate outputs
function main() {
  fs.mkdirSync(EXECUTOR_DIR, { recursive: true });

  // JSON
  fs.writeFileSync(path.join(EXECUTOR_DIR, 'kosame-roadmap-canon.json'), JSON.stringify(ROADMAP, null, 2) + '\n');

  // MD
  var md = ['# KOSAME Dev Orchestra 完成ロードマップ', '', `version: ${ROADMAP.version}`, `generated_at: ${ROADMAP.generated_at}`, `final_arbiter: ${ROADMAP.final_arbiter}`, '', '## フェーズ一覧', ''];
  ROADMAP.phases.forEach(function(ph) {
    md.push('### ' + ph.id + ': ' + ph.phase);
    md.push('- summary: ' + ph.summary);
    md.push('- difficulty: ' + ph.diff + ' | confidentiality: ' + ph.conf + ' | model: ' + ph.model);
    md.push('- human_gate: ' + (ph.gate ? 'YES' : 'no') + ' | audit_required: ' + (ph.audit ? 'YES' : 'no'));
    md.push('- deliverables: ' + ph.deliverables.join(', '));
    if (ph.deps.length) md.push('- deps: ' + ph.deps.join(', '));
    md.push('');
  });
  md.push('## 次の5アクション', '');
  ROADMAP.next_actions.forEach(function(a) { md.push('- ' + a); });
  md.push('', '## Model Lane Rules', '');
  ROADMAP.model_lane_rules.forEach(function(r) { md.push('- ' + r); });
  md.push('', '## Human Gate Rules', '');
  ROADMAP.human_gate_rules.forEach(function(r) { md.push('- ' + r); });
  fs.writeFileSync(path.join(EXECUTOR_DIR, 'kosame-roadmap-canon.md'), md.join('\n'));

  // Next actions MD
  var na = ['# KOSAME Roadmap Next Actions', '', `version: ${ROADMAP.version}`, '', '## Immediate Next', ''];
  ROADMAP.next_actions.forEach(function(a) { na.push('- ' + a); });
  na.push('', '## 現在の完了状況', '', '- v113.3.124: MAX OUTPUT + Console Operation + Limit Break → 完了', '- npm run verify PASS');
  na.push('', '## 注意事項', '', '- DeepSeek V4 Pro = Worker Lane', '- GPT/こさめ = Final Arbitrator', '- commit/push/deploy → human gate', '- sales-dx/transcriber → forbidden');
  fs.writeFileSync(path.join(EXECUTOR_DIR, 'kosame-roadmap-next-actions.md'), na.join('\n'));

  // Handoff for next chat
  var hf = ['# KOSAME Roadmap Handoff for Next Chat', '', '## 現在地', '- version: ' + ROADMAP.version, '- latest commit: d202f8f', '- Field Ops: 20/20 PASS', '- Limit Break: 34/34 PASS', '- Console Operation: ready', '- MAX OUTPUT smoke: 130/130 PASS', '', '## 次にやること', ''];
  ROADMAP.next_actions.slice(0,5).forEach(function(a) { hf.push('- ' + a); });
  hf.push('', '## DeepSeek V4 Proへ渡してよい範囲', '- v113.3.125〜130: すべてsafe/sanitized', '- 実ファイル変更はpublic/allowed filesのみ', '- commit/pushは禁止（human gate）', '', '## GPT/こさめでやること', '- sensitive（Sales DX/transcriber/customer）の裁定', '- v114〜125の人間判断が必要な箇所の判定', '', '## 禁止事項', '- git add -A / git add .', '- 自動push / 自動deploy', '- sales-dx / transcriber / .env / credentials / Secret に触る', '- Codex / Claude 使用', '');
  fs.writeFileSync(path.join(EXECUTOR_DIR, 'roadmap-handoff-for-next-chat.md'), hf.join('\n'));

  console.log('KOSAME_ROADMAP_BEGIN');
  console.log('status: ready');
  console.log('phases: ' + ROADMAP.phases.length);
  console.log('next_actions: ' + ROADMAP.next_actions.length);
  console.log('generated: kosame-roadmap-canon.json, kosame-roadmap-canon.md, kosame-roadmap-next-actions.md, roadmap-handoff-for-next-chat.md');
  console.log('KOSAME_ROADMAP_END');
}

main();
