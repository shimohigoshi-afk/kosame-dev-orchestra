#!/usr/bin/env node
'use strict';

/**
 * KOSAME Dev OS Router v113.3.63
 *
 * タスクを受け取り、担当AIを自動決定して指示文を生成する。
 *
 * 【ルートカテゴリ】
 *   claude_code   : 実装系（機能追加・バグ修正・リファクタ・HTML/CSS/JS）
 *   gemini_cli    : Google Cloud系（deploy・Cloud Run・GCS・Firestore・GCP設定）
 *   deepseek_grok : sanitized土木系（smoke追加・CI設定・Dockerfile・boilerplate）
 *   llama_groq    : 監査系（diff監査・セキュリティレビュー・コンプライアンス）
 *
 * 【セキュリティガード】
 *   営業DX / transcriber タスク → DeepSeek / Grok / Llama への振り分けを自動ブロック
 *
 * Usage:
 *   npm run dev:os                          # 対話モード
 *   node tools/kosame-dev-os-router.js --task="温度感分析を改善して"
 *   node tools/kosame-dev-os-router.js --task="smoke追加して" --json
 *   node tools/kosame-dev-os-router.js --list-routes
 */

const readline = require('node:readline');
const http     = require('node:http');
const path     = require('node:path');

const TOOL_META = {
  version: '113.3.63',
  feature: 'v113-3-63-codex-exec-instruction',
  slug:    'kosame-dev-os-router',
};

const DEFAULT_WORKDIR = '/home/lavie/kosame-dev-orchestra';

// ── ANSI colors ───────────────────────────────────────────────────────────────

const C = {
  reset:   '\x1b[0m', bold:    '\x1b[1m', dim:    '\x1b[2m',
  green:   '\x1b[32m', yellow: '\x1b[33m', blue:   '\x1b[34m',
  cyan:    '\x1b[36m', red:    '\x1b[31m', magenta:'\x1b[35m',
  gray:    '\x1b[90m', orange: '\x1b[38;5;214m', teal: '\x1b[38;5;80m',
};
const c   = (col, t) => `${C[col] || ''}${t}${C.reset}`;
const hr  = (n = 72, ch = '─') => ch.repeat(n);
const box = (label, col) => `${C[col] || ''}▊ ${label}${C.reset}`;

// ── Route definitions ─────────────────────────────────────────────────────────

const ROUTES = {
  claude_code: {
    label:       'Claude Code',
    icon:        '🤖',
    color:       'green',
    description: '実装系 — 機能追加・バグ修正・リファクタ・HTML/CSS/JS/API',
    target:      'claude_code_cli',
  },
  gemini_cli: {
    label:       'Gemini CLI',
    icon:        '☁️',
    color:       'blue',
    description: 'Google Cloud系 — Cloud Run / GCS / Firestore / GCP設定 / デプロイ',
    target:      'gemini_cli',
  },
  deepseek_grok: {
    label:       'DeepSeek / Grok',
    icon:        '⚙️',
    color:       'cyan',
    description: 'sanitized土木系 — smoke追加 / CI設定 / Dockerfile / boilerplate',
    target:      'deepseek_or_grok',
  },
  llama_groq: {
    label:       'Llama / Groq',
    icon:        '🦙',
    color:       'orange',
    description: '監査系 — diff監査 / セキュリティレビュー / コンプライアンスチェック',
    target:      'llama_or_groq',
  },
};

// ── Keyword scoring tables ────────────────────────────────────────────────────

const ROUTE_KEYWORDS = {
  claude_code: {
    weight: 2,
    ja: [
      '実装', '追加', '修正', 'バグ', '修正して', '改善', '変更', '改修',
      '機能', 'リファクタ', 'リファクタリング', '作って', '作成', '追加して',
      '直して', '対応', 'フィーチャー', '新規', '作る',
    ],
    en: [
      'implement', 'add', 'fix', 'bug', 'feature', 'refactor', 'create',
      'build', 'update', 'change', 'modify', 'write', 'develop', 'code',
      'function', 'api', 'endpoint', 'server', 'route', 'handler',
    ],
    file_patterns: [
      '.js', '.ts', '.html', '.css', '.json', '.sh',
      'ui', 'html', 'css', 'javascript', 'typescript', 'node', 'npm',
    ],
    domain: [
      '温度感', '議事録', '音声', 'transcribe', 'pipeline', 'ui',
      'コンポーネント', 'ページ', '画面', 'フォーム',
    ],
  },
  gemini_cli: {
    weight: 3,
    ja: [
      'デプロイ', '設定確認', 'gcloud', 'クラウド', '確認して',
      '作成して', 'バケット', 'サービス', 'リビジョン',
    ],
    en: [
      'gcloud', 'cloud run', 'gcs', 'firestore', 'cloud tasks',
      'cloud build', 'artifact registry', 'pub/sub', 'bigquery',
      'cloud functions', 'deploy', 'cloud storage', 'iam', 'service account',
      'bucket', 'revision', 'container', 'image',
    ],
    domain: [
      'google cloud', 'gcp', 'firebase', 'cloud run', 'cloud build',
      'kosame-prod', 'asia-northeast1', 'artifact registry',
      'kubernetes', 'k8s',
    ],
  },
  deepseek_grok: {
    weight: 2,
    ja: [
      'smoke', 'テスト', 'スモーク', '土木', 'インフラ', '設定', 'CI',
      'パイプライン', '追加して', 'ボイラープレート', '雛形', '追加',
    ],
    en: [
      'smoke', 'test', 'infrastructure', 'infra', 'boilerplate', 'scaffold',
      'template', 'config', 'ci', 'cd', 'github actions', 'workflow',
      'dockerfile', 'docker-compose', 'nginx', 'setup', 'init',
    ],
    domain: [
      'smoke test', 'unit test', 'package.json', 'eslint', 'prettier',
      '.github', 'actions', 'workflow', 'ci/cd', 'lint', 'prettier',
    ],
  },
  llama_groq: {
    weight: 2,
    ja: [
      '監査', 'レビュー', 'チェック', '脆弱性', 'セキュリティ',
      '差分', '確認', '問題ない', 'コードレビュー', '検査', '検証',
    ],
    en: [
      'audit', 'review', 'security', 'vulnerability', 'diff',
      'check', 'compliance', 'inspect', 'analyze', 'scan',
      'pentest', 'penetration', 'owasp', 'cve', 'xss', 'injection',
    ],
    domain: [
      'diff', 'git diff', 'pull request', 'pr review', 'code review',
      'security audit', 'コンプライアンス', 'compliance', '整合性',
    ],
  },
};

// ── Implementation verb priority ──────────────────────────────────────────────

const IMPL_VERBS = ['修正', '追加', '実装', '改善'];

/**
 * タスクに実装動詞（修正・追加・実装・改善）が含まれるか判定する。
 *
 * @param {string} task  (lowercase済みでなくても可)
 * @returns {boolean}
 */
function hasImplVerb(task) {
  return IMPL_VERBS.some(v => task.includes(v));
}

// ── Safety guard ──────────────────────────────────────────────────────────────

const SALES_DX_BLOCK_KEYWORDS = [
  // Paths
  'kosame-sales-dx', 'transcriber', 'sales-dx', '/repos/transcriber', '/repos/kosame-sales-dx',
  // Domain
  '営業DX', '営業 DX', 'sales dx', 'sales_dx',
  // Data
  '顧客情報', '顧客データ', 'customer_info', 'customer_data', 'customerdata',
  // Business info
  '保険料', '約款', '契約情報',
];

const EXTERNAL_AI_ROUTES = new Set(['deepseek_grok', 'llama_groq']);

/**
 * 営業DX / transcriber タスクが外部AIに流れないかガードする。
 *
 * @param {string} task
 * @param {string} routeKey
 * @returns {{ blocked: boolean, reason: string|null, redirectTo: string|null }}
 */
function salesDxGuard(task, routeKey) {
  if (!EXTERNAL_AI_ROUTES.has(routeKey)) {
    return { blocked: false, reason: null, redirectTo: null };
  }
  const lc = task.toLowerCase();
  const hit = SALES_DX_BLOCK_KEYWORDS.find(kw => lc.includes(kw.toLowerCase()));
  if (hit) {
    return {
      blocked:    true,
      reason:     `営業DX / transcriber キーワード検出: "${hit}" → DeepSeek / Grok / Llama へのルーティングをブロック`,
      redirectTo: 'claude_code',
    };
  }
  return { blocked: false, reason: null, redirectTo: null };
}

// ── Classification engine ─────────────────────────────────────────────────────

/**
 * タスクをスコアリングしてルートを決定する。
 *
 * @param {string} task
 * @returns {{ route, score, allScores }}
 */
function classifyTask(task) {
  const lc = task.toLowerCase();
  const scores = {};

  for (const [routeKey, kws] of Object.entries(ROUTE_KEYWORDS)) {
    let score = 0;
    const { weight, ja, en, domain, file_patterns } = kws;

    for (const kw of (ja || []))            { if (lc.includes(kw.toLowerCase()))  score += weight; }
    for (const kw of (en || []))            { if (lc.includes(kw.toLowerCase()))  score += weight; }
    for (const kw of (domain || []))        { if (lc.includes(kw.toLowerCase()))  score += weight * 1.5; }
    for (const kw of (file_patterns || [])) { if (lc.includes(kw.toLowerCase()))  score += 1; }

    scores[routeKey] = score;
  }

  const implVerbHit = hasImplVerb(lc);
  // 実装動詞（修正・追加・実装・改善）があれば claude_code を必ず最優先にする。
  // スコアの底上げに加えて、最終 route を明示的に claude_code に固定する。
  if (implVerbHit) {
    const currentTopScore = Math.max(0, ...Object.values(scores));
    scores.claude_code = Math.max(scores.claude_code || 0, currentTopScore + 1);
  }

  // 最高スコアのルートを決定
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const [topRoute, topScore] = sorted[0];

  // スコアが0の場合はデフォルトで claude_code
  const route = implVerbHit ? 'claude_code' : (topScore > 0 ? topRoute : 'claude_code');

  return { route, score: topScore, allScores: scores };
}

// ── Workdir resolver ──────────────────────────────────────────────────────────

/**
 * workdir または repo からターゲットディレクトリを解決する。
 * workdir 優先。未指定時は repo 名から推定。それも未指定なら DEFAULT_WORKDIR。
 *
 * @param {string|undefined} workdir  絶対パスまたは相対パス
 * @param {string|undefined} repo     リポジトリ名 (例: "transcriber", "kosame-dev-orchestra")
 * @returns {string}
 */
function resolveWorkdir(workdir, repo) {
  if (workdir && typeof workdir === 'string' && workdir.trim()) {
    return workdir.trim();
  }
  if (repo && typeof repo === 'string' && repo.trim()) {
    const r = repo.trim();
    if (r.startsWith('/')) return r;
    if (r === 'kosame-dev-orchestra') return DEFAULT_WORKDIR;
    return `/home/lavie/repos/${r}`;
  }
  return DEFAULT_WORKDIR;
}

// ── Instruction generators ────────────────────────────────────────────────────

function generateClaudeCodeInstruction(task, workdir = DEFAULT_WORKDIR) {
  return [
    '#!/usr/bin/env bash',
    '# KOSAME Dev OS — Claude Code 指示文',
    '# 以下のコマンドをターミナルで実行してください',
    '',
    `codex exec "$(cat <<'KOSAME_EOF'`,
    `あなたはKOSAME Dev Orchestraの実装担当AIです。`,
    `以下のタスクをSafety Stop以外では止まらず完走してください。`,
    ``,
    `【タスク】`,
    task,
    ``,
    `【ルール（厳守）】`,
    `- git add -A禁止（ファイルを個別にaddすること）`,
    `- Safety Stop以外では止めない・確認の質問は不要`,
    `- smoke / verify 通過まで完走する`,
    `- バージョンは package.json のパッチバージョンをインクリメント`,
    `- 実装後に npm run verify を実行して全パス確認`,
    ``,
    `【作業ディレクトリ】`,
    workdir,
    `KOSAME_EOF`,
    `)"`,
  ].join('\n');
}

function generateGeminiCliInstruction(task, workdir = DEFAULT_WORKDIR) {
  return [
    '# KOSAME Dev OS — Gemini CLI 指示文',
    '# 以下のコマンドをターミナルで実行してください',
    '',
    `gemini "$(cat <<'KOSAME_EOF'`,
    `あなたはKOSAME GCP操作アシスタントです。`,
    `以下のGoogle Cloud関連タスクを実行または調査してください。`,
    ``,
    `【タスク】`,
    task,
    ``,
    `【環境情報】`,
    `プロジェクト     : kosame-prod-2026`,
    `リージョン       : asia-northeast1`,
    `サービス         : fk-omiya-console (Cloud Run)`,
    `レジストリ       : asia-northeast1-docker.pkg.dev/kosame-prod-2026/kosame`,
    `作業ディレクトリ : ${workdir}`,
    ``,
    `【注意】`,
    `- 実際の変更・デプロイ操作は npm run deploy:fk-omiya:console を使う`,
    `- 調査・確認のみの場合はdryRunで実行する`,
    `KOSAME_EOF`,
    `)"`,
  ].join('\n');
}

function generateDeepSeekGrokTaskPack(task, workdir = DEFAULT_WORKDIR) {
  const pack = {
    type:      'sanitized_civil_task_pack',
    version:   TOOL_META.version,
    target_ai: ['deepseek', 'grok'],
    generated_at: new Date().toISOString(),
    task: {
      description: task,
      category:    'infrastructure_boilerplate',
    },
    restrictions: {
      no_secrets:          true,
      no_customer_data:    true,
      no_sales_dx:         true,
      no_proprietary_logic: true,
      allowed_operations:  ['read_code', 'write_boilerplate', 'add_tests', 'update_config'],
      blocked_paths: [
        '/home/lavie/repos/transcriber',
        '/home/lavie/repos/kosame-sales-dx',
        '.env', '*.env', 'credentials.json', '~/.kosame/credentials.json',
      ],
      allowed_file_types:  ['.js', '.ts', '.json', '.sh', '.md', '.yaml', '.yml', '.dockerfile', 'Dockerfile*'],
    },
    output_format: {
      type:    'pull_request_ready_diff',
      include: ['changed_files', 'smoke_test', 'verify_result'],
    },
    context: {
      project:   'kosame-dev-orchestra',
      root_path: workdir,
      verify_cmd: 'npm run verify',
    },
    prompt_template: [
      'あなたはKOSAMEのsanitizedコード担当AIです。',
      '以下のTask Packに従って安全な実装のみ行ってください。',
      '',
      '【タスク】',
      task,
      '',
      '【制約】',
      '- 秘密情報・顧客データ・営業DX関連は一切扱わない',
      '- 生成したコードはsmokeテストで動作確認すること',
      '- 完了後に出力したdiffを返すこと',
    ].join('\n'),
  };
  return JSON.stringify(pack, null, 2);
}

function generateLlamaGroqAuditPack(task, workdir = DEFAULT_WORKDIR) {
  const pack = {
    type:      'diff_audit_pack',
    version:   TOOL_META.version,
    target_ai: ['llama3', 'groq'],
    generated_at: new Date().toISOString(),
    task: {
      description: task,
      category:    'security_compliance_audit',
    },
    audit_focus: [
      'security_vulnerabilities',
      'logic_errors',
      'compliance_violations',
      'code_quality',
      'owasp_top10',
    ],
    restrictions: {
      no_secrets:       true,
      no_customer_data: true,
      read_only:        true,
      output_only:      ['audit_report', 'risk_score', 'recommendations'],
    },
    input_instructions: [
      '監査対象のdiffまたはファイル内容を以下に貼り付けてください:',
      '',
      '```diff',
      '# git diff HEAD~1 HEAD の出力を貼り付け',
      '```',
    ].join('\n'),
    output_schema: {
      risk_level:      'critical | high | medium | low | info',
      issues:          [{ id: 'string', severity: 'string', location: 'string', description: 'string', recommendation: 'string' }],
      compliance_ok:   'boolean',
      summary:         'string',
    },
    prompt_template: [
      'あなたはKOSAMEのセキュリティ監査AIです。',
      '以下のdiff/コードを監査し、セキュリティ・品質・コンプライアンスの観点でレポートを生成してください。',
      '',
      '【監査タスク】',
      task,
      '',
      '【重点チェック項目】',
      '- OWASP Top 10 (XSS / SQLi / SSRF / コマンドインジェクション等)',
      '- 秘密情報のハードコード',
      '- 認証・認可の欠陥',
      '- エラーハンドリングの不備',
      '- 依存パッケージの既知脆弱性',
      '',
      '出力はJSON形式で: { risk_level, issues[], compliance_ok, summary }',
    ].join('\n'),
  };
  return JSON.stringify(pack, null, 2);
}

// ── Main route function ───────────────────────────────────────────────────────

/**
 * タスクをルーティングして指示文を生成する。
 *
 * @param {string} task
 * @param {object} opts  { verbose, workdir, repo }
 * @returns {{
 *   route, routeMeta, score, allScores,
 *   blocked, blockReason, redirectedFrom,
 *   instruction, instructionFormat, workdir
 * }}
 */
function routeTask(task, opts = {}) {
  if (!task || typeof task !== 'string' || !task.trim()) {
    throw new Error('task must be a non-empty string');
  }

  const { route: classifiedRoute, score, allScores } = classifyTask(task.trim());

  // セキュリティガード
  const guard = salesDxGuard(task, classifiedRoute);
  const finalRoute = guard.blocked ? guard.redirectTo : classifiedRoute;

  const routeMeta = ROUTES[finalRoute];
  if (!routeMeta) throw new Error(`unknown route: "${finalRoute}"`);

  const workdir = resolveWorkdir(opts.workdir, opts.repo);

  // 指示文生成
  let instruction;
  let instructionFormat;
  switch (finalRoute) {
    case 'claude_code':
      instruction       = generateClaudeCodeInstruction(task.trim(), workdir);
      instructionFormat = 'bash_script';
      break;
    case 'gemini_cli':
      instruction       = generateGeminiCliInstruction(task.trim(), workdir);
      instructionFormat = 'bash_script';
      break;
    case 'deepseek_grok':
      instruction       = generateDeepSeekGrokTaskPack(task.trim(), workdir);
      instructionFormat = 'json_task_pack';
      break;
    case 'llama_groq':
      instruction       = generateLlamaGroqAuditPack(task.trim(), workdir);
      instructionFormat = 'json_audit_pack';
      break;
    default:
      throw new Error(`no instruction generator for route: "${finalRoute}"`);
  }

  return {
    route:           finalRoute,
    routeMeta,
    score,
    allScores,
    blocked:         guard.blocked,
    blockReason:     guard.reason,
    redirectedFrom:  guard.blocked ? classifiedRoute : null,
    instruction,
    instructionFormat,
    workdir,
  };
}

// ── Pretty printer ────────────────────────────────────────────────────────────

function printResult(task, result, opts = {}) {
  const { json = false } = opts;

  if (json) {
    console.log(JSON.stringify({
      task,
      route:             result.route,
      route_label:       result.routeMeta.label,
      score:             result.score,
      all_scores:        result.allScores,
      blocked:           result.blocked,
      block_reason:      result.blockReason,
      redirected_from:   result.redirectedFrom,
      instruction_format: result.instructionFormat,
      instruction:       result.instruction,
    }, null, 2));
    return;
  }

  console.log('');
  console.log(c('bold', hr(72)));
  console.log(c('bold', `  KOSAME Dev OS Router  v${TOOL_META.version}`));
  console.log(c('dim', hr(72)));

  // Task
  console.log('');
  console.log(`  ${c('gray', 'タスク')}  ${c('bold', task)}`);
  console.log('');

  // Security block alert
  if (result.blocked) {
    console.log(`  ${c('bold', c('red', '⛔ SAFETY BLOCK'))}  ${c('red', result.blockReason)}`);
    console.log(`  ${c('yellow', '↳ リダイレクト先:')} ${c('bold', ROUTES[result.redirectedFrom]?.label || result.redirectedFrom)} → ${c('bold', result.routeMeta.label)}`);
    console.log('');
  }

  // Route decision
  const meta = result.routeMeta;
  console.log(`  ${c('dim', '担当AI')}  ${meta.icon}  ${c(meta.color, c('bold', meta.label))}`);
  console.log(`  ${c('dim', '種別  ')}  ${meta.description}`);
  console.log(`  ${c('dim', 'スコア')}  ${result.score > 0 ? c('green', String(result.score)) : c('dim', '0 (default)')}`);

  // Score breakdown (verbose)
  if (opts.verbose) {
    console.log('');
    console.log(c('dim', '  スコア内訳:'));
    for (const [r, s] of Object.entries(result.allScores).sort(([,a],[,b]) => b-a)) {
      const bar = '█'.repeat(Math.min(s, 20));
      const active = r === result.route;
      console.log(`    ${active ? c(ROUTES[r].color, '▶') : ' '} ${(r + '             ').slice(0,14)} ${c(active ? ROUTES[r].color : 'dim', bar || '·')} ${s}`);
    }
  }

  console.log('');
  console.log(c('dim', hr(72)));
  console.log('');

  // Instruction
  const fmt = result.instructionFormat;
  if (fmt === 'bash_script') {
    console.log(c('bold', '  ── 生成された指示文 ──'));
    console.log('');
    // 各行に2スペースインデントして表示
    for (const line of result.instruction.split('\n')) {
      console.log('  ' + (line.startsWith('#') ? c('dim', line) : line));
    }
  } else {
    // JSON pack
    const packType = fmt === 'json_audit_pack' ? '監査Pack' : 'Task Pack';
    console.log(c('bold', `  ── 生成された ${packType} (JSON) ──`));
    console.log('');
    const lines = result.instruction.split('\n');
    for (const line of lines) {
      const colored = line
        .replace(/"([^"]+)":/g, `"${c('cyan', '$1')}":`)
        .replace(/: "(.*?)"/g, `: "${c('yellow', '$1')}"`);
      console.log('  ' + colored);
    }
  }

  console.log('');
  console.log(c('dim', hr(72)));
  console.log('');
}

// ── Interactive mode ──────────────────────────────────────────────────────────

async function interactiveMode() {
  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
    prompt: c('green', '  dev:os> ') + '',
  });

  console.log('');
  console.log(c('bold', `  KOSAME Dev OS Router v${TOOL_META.version}  ${c('dim', '— 対話モード')}`));
  console.log(c('dim', `  タスクを入力してEnter。 ${c('bold', 'exit')} で終了。 ${c('bold', '--verbose')} で詳細スコア表示。`));
  console.log('');
  console.log(c('dim', '  ルート一覧:'));
  for (const [key, meta] of Object.entries(ROUTES)) {
    console.log(`    ${meta.icon}  ${c(meta.color, meta.label.padEnd(18))} ${c('dim', meta.description)}`);
  }
  console.log('');
  console.log(c('dim', '  タスク例:'));
  console.log(c('dim', '    「温度感分析を改善して」         → Claude Code'));
  console.log(c('dim', '    「smoke追加して」                → DeepSeek/Grok Task Pack'));
  console.log(c('dim', '    「Google Cloud Run設定確認」     → Gemini CLI'));
  console.log(c('dim', '    「コードをセキュリティレビューして」→ Llama/Groq 監査Pack'));
  console.log('');

  rl.prompt();

  rl.on('line', (input) => {
    const line = input.trim();
    if (!line) { rl.prompt(); return; }
    if (line === 'exit' || line === 'quit' || line === ':q') {
      console.log(c('dim', '  bye.'));
      rl.close();
      process.exit(0);
    }
    if (line === '--list-routes' || line === 'routes') {
      for (const [key, meta] of Object.entries(ROUTES)) {
        console.log(`  ${meta.icon}  ${c(meta.color, key.padEnd(16))} ${meta.description}`);
      }
      console.log('');
      rl.prompt();
      return;
    }

    const verbose = line.includes('--verbose') || line.includes('-v');
    const jsonMode = line.includes('--json');
    const task = line.replace(/--verbose|-v|--json/g, '').trim();

    if (!task) { rl.prompt(); return; }

    try {
      const result = routeTask(task);
      printResult(task, result, { verbose, json: jsonMode });
    } catch (e) {
      console.log(c('red', `  エラー: ${e.message}`));
    }
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────

function parseCLIArgs(argv) {
  const args = argv.slice(2);
  const get  = (flag) => { const a = args.find(a => a.startsWith(flag + '=')); return a ? a.slice(flag.length + 1) : null; };
  return {
    task:      get('--task'),
    json:      args.includes('--json'),
    verbose:   args.includes('--verbose') || args.includes('-v'),
    listRoutes: args.includes('--list-routes'),
    interactive: args.includes('--interactive') || args.includes('-i'),
  };
}

async function main() {
  const opts = parseCLIArgs(process.argv);

  if (opts.listRoutes) {
    console.log('');
    for (const [key, meta] of Object.entries(ROUTES)) {
      console.log(`  ${meta.icon}  ${c(meta.color, c('bold', meta.label))}`);
      console.log(`     key: ${key}`);
      console.log(`     ${meta.description}`);
      console.log('');
    }
    return;
  }

  if (opts.task) {
    try {
      const result = routeTask(opts.task);
      printResult(opts.task, result, { verbose: opts.verbose, json: opts.json });
    } catch (e) {
      process.stderr.write(`[DevOsRouter] error: ${e.message}\n`);
      process.exit(1);
    }
    return;
  }

  // デフォルト: 対話モード（stdin が TTY の場合）または引数なし
  if (process.stdin.isTTY || opts.interactive || process.argv.length === 2) {
    await interactiveMode();
  } else {
    // stdin からタスクを読む
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => {
      const task = Buffer.concat(chunks).toString('utf8').trim();
      if (!task) { process.stderr.write('No task provided via stdin.\n'); process.exit(1); }
      try {
        const result = routeTask(task);
        printResult(task, result, { verbose: opts.verbose, json: opts.json });
      } catch (e) {
        process.stderr.write(`[DevOsRouter] error: ${e.message}\n`);
        process.exit(1);
      }
    });
  }
}

// ── HTTP Server ───────────────────────────────────────────────────────────────

const DEV_OS_PORT = Number(process.env.DEV_OS_PORT) || 8091;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > 1024 * 1024) { req.destroy(); return reject(new Error('request body too large')); }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

/**
 * POST /api/dev-os
 * Body: { task: string, verbose?: boolean }
 * Returns: { ok, route, route_label, route_description, instruction_format, instruction,
 *             score, all_scores, blocked, block_reason, redirected_from }
 *
 * GET /api/dev-os/routes
 * Returns: { ok, routes: [{ key, label, icon, description }] }
 *
 * GET /api/dev-os/health
 * Returns: { ok, version, mode }
 */
async function handleDevOsRequest(req, res) {
  const url  = req.url || '/';
  const meth = req.method || 'GET';

  res.setHeader('X-Kosame-Version', TOOL_META.version);

  if (url === '/api/dev-os/health' && meth === 'GET') {
    return sendJson(res, 200, { ok: true, version: TOOL_META.version, mode: 'server', slug: TOOL_META.slug });
  }

  if (url === '/api/dev-os/routes' && meth === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      routes: Object.entries(ROUTES).map(([key, meta]) => ({
        key, label: meta.label, icon: meta.icon, description: meta.description,
      })),
    });
  }

  if (url === '/api/dev-os' && meth === 'POST') {
    let body;
    try { body = await readBody(req); }
    catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }

    const { task, verbose, workdir, repo } = body;
    if (!task || typeof task !== 'string' || !task.trim()) {
      return sendJson(res, 400, { ok: false, error: 'task must be a non-empty string' });
    }

    try {
      const result = routeTask(task.trim(), { workdir, repo });
      return sendJson(res, 200, {
        ok:               true,
        route:            result.route,
        route_label:      result.routeMeta.label,
        route_icon:       result.routeMeta.icon,
        route_description: result.routeMeta.description,
        instruction_format: result.instructionFormat,
        instruction:      result.instruction,
        score:            result.score,
        all_scores:       result.allScores,
        blocked:          result.blocked,
        block_reason:     result.blockReason,
        redirected_from:  result.redirectedFrom,
        workdir:          result.workdir,
      });
    } catch (e) {
      process.stderr.write(`[DevOsRouter] routeTask error: ${e.message}\n`);
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  return sendJson(res, 404, { ok: false, error: `not found: ${meth} ${url}` });
}

function createDevOsServer() {
  return http.createServer((req, res) => {
    handleDevOsRequest(req, res).catch((e) => {
      process.stderr.write(`[DevOsRouter] unhandled error: ${e.message}\n`);
      try { sendJson(res, 500, { ok: false, error: 'internal server error' }); } catch {}
    });
  });
}

function startDevOsServer(port = DEV_OS_PORT) {
  const server = createDevOsServer();
  return new Promise((resolve, reject) => {
    server.listen(port, '0.0.0.0', () => {
      const addr = server.address();
      process.stderr.write(`[DevOsRouter] HTTP server listening on port ${addr.port}\n`);
      process.stderr.write(`[DevOsRouter] POST /api/dev-os  GET /api/dev-os/routes  GET /api/dev-os/health\n`);
      resolve(server);
    });
    server.once('error', reject);
  });
}

// ── main & CLI ────────────────────────────────────────────────────────────────

if (require.main === module) {
  if (process.env.DEV_OS_MODE === 'server') {
    startDevOsServer().catch((e) => { process.stderr.write(`[DevOsRouter] fatal: ${e.message}\n`); process.exit(1); });
  } else {
    main().catch((e) => { process.stderr.write(`[DevOsRouter] fatal: ${e.message}\n`); process.exit(1); });
  }
}

// ── exports ───────────────────────────────────────────────────────────────────

module.exports = {
  TOOL_META,
  DEFAULT_WORKDIR,
  ROUTES,
  ROUTE_KEYWORDS,
  IMPL_VERBS,
  hasImplVerb,
  SALES_DX_BLOCK_KEYWORDS,
  EXTERNAL_AI_ROUTES,
  classifyTask,
  salesDxGuard,
  routeTask,
  generateClaudeCodeInstruction,
  generateGeminiCliInstruction,
  generateDeepSeekGrokTaskPack,
  generateLlamaGroqAuditPack,
  handleDevOsRequest,
  createDevOsServer,
  startDevOsServer,
  DEV_OS_PORT,
};
