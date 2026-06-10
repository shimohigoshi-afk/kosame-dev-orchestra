#!/usr/bin/env node
'use strict';

/**
 * KOSAME Dev Orchestra — Real-time Dashboard v110.41.0
 *
 * Multi-project dashboard showing per-project:
 *   - git log (last 5 commits)
 *   - CI state (via gh run list)
 *   - Cost summary
 *
 * Plus global:
 *   - Active AI agents (Gemini / GPT / Claude / Grok)
 *   - Cumulative cost by provider
 *   - Recent work log
 *
 * Usage:
 *   npm run dashboard           # port 8080 (Cloud Shell preview)
 *   npm run dashboard -- --port=3000
 *
 * Adding a new project: add one entry to PROJECTS below.
 * State is read from state/dashboard-state.json when present.
 * dryRun=true by default — no writes without explicit --write flag.
 */

const http   = require('node:http');
const fs     = require('node:fs');
const path   = require('node:path');
const { execSync } = require('node:child_process');

const { PRICE_TABLE, createSession } = require('./cost-tracker');
const { createWorkLog, AGENT_ROLE, ACTION_TYPE } = require('./multi-agent-work-log');
const { getConfig } = require('../providers/provider-config');
const os = require('os');

const TOOL_META = {
  version: '110.41.0',
  feature: 'v110-22-multi-project-dashboard',
  title:   'KOSAME Dev Orchestra Dashboard',
  slug:    'kosame-dashboard',
};

const ROOT          = path.resolve(__dirname, '..');
const STATE_FILE    = path.join(ROOT, 'state', 'dashboard-state.json');
const REGISTRY_FILE = path.join(ROOT, 'state', 'projects-registry.json');

// ── Project registry ──────────────────────────────────────────────────────────
// Add new projects here — one object per project.
// 動的プロジェクトは state/projects-registry.json に追加 (kosame-project-initializer)。

const PROJECTS = [
  {
    key:        'kosame-dev-orchestra',
    label:      'kosame-dev-orchestra',
    path:       path.resolve(__dirname, '..'),
    color:      '#58a6ff',
    githubRepo: 'shimohigoshi-afk/kosame-dev-orchestra',
  },
  {
    key:        'anesty-board',
    label:      'anesty-board',
    path:       path.resolve('/home/lavie/projects/anesty-board'),
    color:      '#d97706',
    githubRepo: 'shimohigoshi-afk/anesty-board-cloudshell',
    cloudRun:   { service: 'anesty-board', project: 'kosame-prod-2026', region: 'asia-northeast1' },
    scheduler:  { job: 'anesty-board-morning-report-9am', project: 'kosame-prod-2026', location: 'asia-northeast1' },
  },
];

// ── Dynamic project registry ──────────────────────────────────────────────────
// state/projects-registry.json から動的プロジェクトを読み込み、
// 重複（同一 key）を除いて PROJECTS にマージする。

function loadDynamicProjects() {
  if (!fs.existsSync(REGISTRY_FILE)) return [];
  try {
    const reg = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
    if (!Array.isArray(reg.projects)) return [];
    const knownKeys = new Set(PROJECTS.map(p => p.key));
    return reg.projects.filter(p => p.key && !knownKeys.has(p.key));
  } catch (_) { return []; }
}

function getEffectiveProjects() {
  return [...PROJECTS, ...loadDynamicProjects()];
}

// ── Agent display config ──────────────────────────────────────────────────────

const AGENT_CONFIG = {
  gemini:   { label: 'Gemini',           color: '#4285f4', icon: 'G' },
  gpt:      { label: 'GPT',              color: '#10a37f', icon: 'P' },
  claude:   { label: 'Claude',           color: '#d97706', icon: 'C' },
  grok:     { label: 'Grok',             color: '#8b5cf6', icon: 'X' },
  deepseek: { label: 'DeepSeek V4 Flash', color: '#e11d48', icon: 'D' },
};

// ── Per-project state builder ─────────────────────────────────────────────────

function recentGitLog(projPath, n = 5) {
  try {
    const out = execSync(
      `git log --oneline --pretty=format:"%H|%ai|%s" -${n}`,
      { cwd: projPath, encoding: 'utf8', timeout: 5000 }
    );
    return out.trim().split('\n').filter(Boolean).map(line => {
      const [hash, ts, ...rest] = line.split('|');
      return { hash: hash.slice(0, 7), ts, subject: rest.join('|') };
    });
  } catch (_) {
    return [];
  }
}

function readCiState(githubRepo) {
  try {
    const out = execSync(
      `gh run list --repo ${githubRepo} --limit 1 --json status,conclusion,name,headBranch`,
      { encoding: 'utf8', timeout: 8000 }
    );
    const runs = JSON.parse(out.trim());
    if (!runs || runs.length === 0) return { status: 'unknown', name: '', branch: '' };
    const r = runs[0];
    let status = 'unknown';
    if (r.status === 'completed') {
      status = r.conclusion === 'success' ? 'success'
             : r.conclusion === 'failure' ? 'failure'
             : r.conclusion || 'unknown';
    } else if (r.status === 'in_progress' || r.status === 'queued') {
      status = 'pending';
    }
    return { status, name: r.name || '', branch: r.headBranch || '' };
  } catch (_) {
    return { status: 'unknown', name: '', branch: '' };
  }
}

function buildDemoCostForProject(key) {
  const session = createSession({ sessionId: `demo-${key}`, dryRun: true });
  if (key === 'kosame-dev-orchestra') {
    session.record('task-1', 'gemini-2.0-flash',  8000, 2000);
    session.record('task-1', 'gpt-4o-mini',        3000,  600);
    session.record('task-2', 'gemini-2.0-flash',  6000, 1500);
    session.record('task-3', 'claude-sonnet-4-6',  4000,  800);
  } else {
    session.record('task-1', 'gemini-2.0-flash',  4000, 1000);
    session.record('task-2', 'gpt-4o-mini',        2000,  400);
  }
  const rep = session.comparisonReport({ silent: true });
  return {
    totalUsd:          rep.sessionTotalUsd,
    byProvider:        rep.byProvider,
    claudeEstimateUsd: rep.claudeTeamEstimateUsd,
    savingPct:         rep.estimatedSavingPct,
  };
}

function readCloudRunStatus(proj) {
  const cr = proj.cloudRun;
  if (!cr) return null;
  try {
    const out = execSync(
      `gcloud run services describe ${cr.service} --region=${cr.region} --project=${cr.project} --format=json`,
      { encoding: 'utf8', timeout: 10000 }
    );
    const svc = JSON.parse(out);
    const ready = svc?.status?.conditions?.find(c => c.type === 'Ready')?.status === 'True';
    const versionLabel = svc?.metadata?.labels?.version || '';
    return {
      url:    svc?.status?.url || '',
      ready,
      revision: svc?.status?.latestReadyRevisionName || '',
      version:  versionLabel.replace(/_/g, '.'),
    };
  } catch (_) {
    return { url: '', ready: false, revision: '', version: '' };
  }
}

function readGitTag(projPath) {
  try {
    const out = execSync(
      `git tag --list 'v*' --sort=-v:refname --format='%(refname:short)'`,
      { cwd: projPath, encoding: 'utf8', timeout: 5000 }
    );
    const tags = out.trim().split('\n').filter(Boolean);
    return tags.length > 0 ? tags[0].replace(/^v/i, '') : '';
  } catch (_) {
    return '';
  }
}

function readSchedulerStatus(proj) {
  const sc = proj.scheduler;
  if (!sc) return null;
  try {
    const out = execSync(
      `gcloud scheduler jobs describe ${sc.job} --location=${sc.location} --project=${sc.project} --format=json`,
      { encoding: 'utf8', timeout: 10000 }
    );
    const job = JSON.parse(out);
    return {
      schedule:   job.schedule || '',
      timeZone:   job.timeZone || '',
      state:      job.state || '',
      lastRun:    job.lastAttemptTime || '',
      nextRun:    job.scheduleTime || '',
    };
  } catch (_) {
    return { schedule: '', timeZone: '', state: '', lastRun: '', nextRun: '' };
  }
}

function buildProjectState(proj) {
  const gitLog = recentGitLog(proj.path, 5);
  const ci     = readCiState(proj.githubRepo);
  const cost   = buildDemoCostForProject(proj.key);

  const cloudRun  = readCloudRunStatus(proj);
  const scheduler = readSchedulerStatus(proj);

  let version = cloudRun?.version || readGitTag(proj.path) || '';
  if (!version) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(proj.path, 'package.json'), 'utf8'));
      version = pkg.version || '';
    } catch (_) {}
  }

  return {
    key:     proj.key,
    label:   proj.label,
    color:   proj.color,
    version,
    gitLog,
    ci,
    cost,
    cloudRun,
    scheduler,
  };
}

// ── Global state builder ──────────────────────────────────────────────────────

function readStateFile() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (_) { /* ignore */ }
  return null;
}

function inferAgentFromSubject(subject) {
  const s = subject.toLowerCase();
  if (s.includes('gemini') || s.includes('provider')) return 'gemini';
  if (s.includes('gpt') || s.includes('openai') || s.includes('route')) return 'gpt';
  if (s.includes('claude') || s.includes('patch') || s.includes('inbox')) return 'claude';
  if (s.includes('grok')) return 'grok';
  return 'claude';
}

function buildDemoWorkLog() {
  const wl = createWorkLog({ sessionId: 'demo', productId: 'kosame-dev-orchestra', dryRun: true });
  const commits = recentGitLog(ROOT, 12);

  if (commits.length > 0) {
    for (const c of commits) {
      const agent  = inferAgentFromSubject(c.subject);
      const action = c.subject.toLowerCase().includes('fix') || c.subject.toLowerCase().includes('hotfix')
        ? ACTION_TYPE.REPAIR : ACTION_TYPE.IMPLEMENT;
      wl.append(agent, action, {
        taskId:      c.hash,
        description: c.subject.slice(0, 60),
        meta:        { ts: c.ts },
      });
    }
  } else {
    wl.implement('gemini-2.5-flash', { taskId: 'demo-1', description: 'Demo: UIコンポーネント実装' });
    wl.arbitrate('gpt-4o-mini',      { taskId: 'demo-1', description: 'Demo: タスクルーティング' });
    wl.repair   ('claude-sonnet-4-6',{ taskId: 'demo-1', description: 'Demo: バグ修正' });
  }

  return wl.timeline();
}

function buildDemoCost() {
  const session = createSession({ sessionId: 'demo', dryRun: true });
  session.record('task-1', 'gemini-2.0-flash',  8000, 2000);
  session.record('task-1', 'gpt-4o-mini',        3000,  600);
  session.record('task-2', 'gemini-2.0-flash',  6000, 1500);
  session.record('task-3', 'claude-sonnet-4-6',  4000,  800);
  const rep = session.comparisonReport({ silent: true });
  return {
    totalUsd:          rep.sessionTotalUsd,
    byProvider:        rep.byProvider,
    claudeEstimateUsd: rep.claudeTeamEstimateUsd,
    savingPct:         rep.estimatedSavingPct,
  };
}


function loadLearningLogEntries() {
  const logFile = path.join(os.homedir(), ".kosame", "learning-log.jsonl");
  try {
    if (!fs.existsSync(logFile)) return [];
    return fs.readFileSync(logFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean)
      .slice(-5)
      .reverse();
  } catch {
    return [];
  }
}

function buildAutoRecordingState() {
  const recent = loadLearningLogEntries();
  const latest = recent[0] || null;
  return {
    status: recent.length ? "available" : "empty",
    recentCount: recent.length,
    latestTask: latest ? (latest.taskInput || latest.taskType || "") : "",
    difficulty: latest ? (latest.difficulty || "") : "",
    provider: latest ? (latest.provider || "") : "",
    model: latest ? (latest.model || "") : "",
    success: latest ? Boolean(latest.success) : false,
    dryRun: latest ? Boolean(latest.dryRun) : true,
    timestamp: latest ? (latest.ts || latest.timestamp || "") : "",
    recent
  };
}

function buildDashboardState(opts = {}) {
  const dryRun = opts.dryRun !== false;
  const persisted = readStateFile();
  const providerCfg = getConfig();

  const workLogEntries = persisted?.workLog ?? buildDemoWorkLog();
  const cost           = persisted?.cost     ?? buildDemoCost();

  const nowMs = Date.now();
  function isActive(agentKey) {
    return workLogEntries.some(e => {
      const age = nowMs - new Date(e.ts).getTime();
      return e.role === agentKey && age < 60_000;
    });
  }

  const recentAgents = new Set(workLogEntries.slice(0, 5).map(e => e.role));

  const agents = {};
  for (const [key, cfg] of Object.entries(AGENT_CONFIG)) {
    const keyPresent = key === 'gemini'   ? providerCfg.geminiKeyPresent
                     : key === 'gpt'      ? providerCfg.openaiKeyPresent
                     : key === 'claude'   ? true
                     : key === 'deepseek' ? providerCfg.deepseekKeyPresent
                     : false;
    agents[key] = {
      label:     cfg.label,
      color:     cfg.color,
      icon:      cfg.icon,
      status:    isActive(key) ? 'active' : recentAgents.has(key) ? 'recent' : 'idle',
      keyPresent,
      model:     persisted?.agents?.[key]?.model ?? defaultModel(key),
      lastTs:    workLogEntries.find(e => e.role === key)?.ts ?? null,
    };
  }

  // Build per-project state (hardcoded + dynamic registry)
  const projects = getEffectiveProjects().map(buildProjectState);

  return {
    autoRecording: buildAutoRecordingState(),
    version:  TOOL_META.version,
    feature:  TOOL_META.feature,
    ts:       new Date().toISOString(),
    dryRun,
    demo:     !persisted,
    agents,
    cost,
    workLog:  workLogEntries.slice(0, 30),
    projects,
  };
}

function defaultModel(key) {
  return { gemini: 'gemini-2.5-flash', gpt: 'gpt-4o-mini', claude: 'claude-sonnet-4-6', grok: 'grok-2', deepseek: 'deepseek-v4-flash' }[key] ?? 'unknown';
}

// ── HTML template ─────────────────────────────────────────────────────────────

function renderHtml() {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KOSAME Dev Orchestra Dashboard</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0d1117;color:#c9d1d9;font-family:'Courier New',Consolas,monospace;font-size:13px;padding:16px}
  h1{font-size:18px;color:#58a6ff;letter-spacing:2px;margin-bottom:4px}
  .subtitle{color:#8b949e;font-size:11px;margin-bottom:20px}
  .badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:bold;letter-spacing:1px}
  .badge-dry{background:#1f3a5f;color:#58a6ff}
  .badge-live{background:#1a3a2a;color:#3fb950}

  /* ── Project grid ── */
  .projects{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px;margin-bottom:20px}
  .project-card{background:#161b22;border:1px solid #30363d;border-radius:6px;overflow:hidden}
  .project-header{padding:10px 14px;border-bottom:1px solid #21262d;display:flex;align-items:center;gap:10px}
  .project-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
  .project-title{font-size:13px;font-weight:bold;color:#e6edf3;flex:1}
  .project-ver{font-size:10px;color:#8b949e}
  .ci-badge{font-size:10px;padding:2px 7px;border-radius:3px;font-weight:bold;flex-shrink:0}
  .ci-success{background:#1a3a2a;color:#3fb950}
  .ci-failure{background:#2d1a1a;color:#f85149}
  .ci-pending{background:#2d2a1a;color:#d29922}
  .ci-unknown{background:#1c2128;color:#8b949e}
  .project-body{padding:12px 14px}
  .project-cost{font-size:11px;color:#8b949e;margin-bottom:10px}
  .project-cost strong{color:#e6edf3}

  /* Git log table */
  .git-log{width:100%;border-collapse:collapse}
  .git-log td{padding:3px 0;font-size:11px;vertical-align:top}
  .git-hash{color:#58a6ff;width:54px;flex-shrink:0;font-size:10px;padding-right:8px}
  .git-ts{color:#8b949e;width:80px;flex-shrink:0;font-size:10px;padding-right:8px;white-space:nowrap}
  .git-subject{color:#c9d1d9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:0;width:100%}
  .git-log tr:not(:last-child) td{border-bottom:1px solid #161b22}

  /* Agent cards */
  .agents{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px}
  .agent-card{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:14px 12px;position:relative;overflow:hidden}
  .agent-card.active{border-color:var(--c)}
  .agent-card.active::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--c)}
  .agent-icon{font-size:22px;font-weight:bold;color:var(--c);margin-bottom:6px}
  .agent-label{font-size:14px;font-weight:bold;color:#e6edf3;margin-bottom:4px}
  .agent-model{font-size:10px;color:#8b949e;margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .status-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px}
  .dot-active{background:#3fb950;box-shadow:0 0 6px #3fb950}
  .dot-recent{background:#d29922}
  .dot-idle{background:#484f58}
  .agent-status-text{font-size:11px}
  .status-active{color:#3fb950}
  .status-recent{color:#d29922}
  .status-idle{color:#8b949e}
  .key-badge{font-size:9px;padding:1px 5px;border-radius:2px;margin-top:6px;display:inline-block}
  .key-ok{background:#1a3a2a;color:#3fb950}
  .key-missing{background:#2d1a1a;color:#f85149}

  /* Cost section */
  .section{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:14px;margin-bottom:14px}
  .section-title{font-size:11px;color:#8b949e;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;border-bottom:1px solid #21262d;padding-bottom:6px}
  .cost-total{font-size:22px;color:#e6edf3;font-weight:bold;margin-bottom:10px}
  .cost-sub{font-size:11px;color:#8b949e}
  .cost-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}
  .cost-label{width:60px;color:#c9d1d9;font-size:12px}
  .cost-bar-wrap{flex:1;height:6px;background:#21262d;border-radius:3px;overflow:hidden}
  .cost-bar{height:100%;border-radius:3px;transition:width .5s}
  .cost-val{width:80px;text-align:right;font-size:11px;color:#8b949e}
  .saving-box{margin-top:10px;padding:8px 10px;background:#0d2818;border:1px solid #1a4731;border-radius:4px;font-size:11px;color:#3fb950}

  /* Work log */
  .log-row{display:flex;align-items:baseline;gap:8px;padding:5px 0;border-bottom:1px solid #161b22;font-size:11px}
  .log-row:last-child{border-bottom:none}
  .log-ts{color:#8b949e;flex-shrink:0;width:85px}
  .log-icon{width:18px;height:18px;border-radius:3px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:bold;flex-shrink:0;color:#0d1117}
  .log-action{width:70px;flex-shrink:0;color:#8b949e;font-size:10px}
  .log-desc{color:#c9d1d9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .log-task{color:#58a6ff;font-size:10px;flex-shrink:0}

  .footer{text-align:center;color:#484f58;font-size:10px;margin-top:16px}
  .updated{font-size:10px;color:#484f58;margin-top:2px}

  @media(max-width:700px){
    .agents{grid-template-columns:repeat(3,1fr)}
    .projects{grid-template-columns:1fr}
  }
</style>
</head>
<body>
<h1>⬡ KOSAME Dev Orchestra</h1>
<div class="subtitle">Multi-Project Dashboard &nbsp;·&nbsp; <span id="mode-badge"></span></div>

<div class="project-card" id="auto-recording-card" style="margin-bottom:20px">
  <div class="project-header">
    <span class="project-dot" style="background:#58a6ff"></span>
    <strong>Auto Recording</strong>
  </div>
  <div class="project-body" id="auto-recording">
    <div class="muted">loading...</div>
  </div>
</div>

<div class="projects" id="projects"></div>

<div class="section">
  <div class="section-title">AI Agents</div>
  <div class="agents" id="agents"></div>
</div>

<div class="section">
  <div class="section-title">Cost Accumulator</div>
  <div class="cost-total" id="cost-total">$0.000000</div>
  <div class="cost-sub" id="cost-sub"></div>
  <div id="cost-bars"></div>
  <div id="saving-box"></div>
</div>

<div class="section">
  <div class="section-title">Recent Work Log</div>
  <div id="work-log"></div>
</div>

<div class="footer">KOSAME Dev Orchestra v<span id="dash-ver">-</span></div>
<div class="updated" id="updated"></div>

<script>
const AGENT_COLORS = {
  gemini:'#4285f4', gpt:'#10a37f', claude:'#d97706', grok:'#8b5cf6', deepseek:'#e11d48'
};
const PROVIDER_BAR_COLOR = {
  gemini:'#4285f4', openai:'#10a37f', claude:'#d97706', grok:'#8b5cf6',
  deepseek:'#ec4899', kimi:'#06b6d4'
};

function fmtTs(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
function fmtDate(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  return d.toLocaleDateString('ja-JP', {month:'2-digit',day:'2-digit'})
    + ' ' + d.toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit'});
}
function fmtUsd(n) { return '$' + (n||0).toFixed(6); }


function renderAutoRecording(autoRecording) {
  const wrap = document.getElementById('auto-recording');
  if (!wrap) return;
  const a = autoRecording || {};
  const recent = Array.isArray(a.recent) ? a.recent : [];
  const status = a.status || 'empty';
  const latest = a.latestTask || '(no task yet)';
  const provider = [a.provider, a.model].filter(Boolean).join(' / ') || '-';
  const success = a.success ? 'success' : (recent.length ? 'failed/unknown' : '-');
  const mode = a.dryRun === false ? 'live' : 'dryRun';
  const ts = a.timestamp || '-';

  wrap.innerHTML =
    '<div style="padding:12px 14px">' +
      '<div><span class="muted">status:</span> <strong>' + escHtml(status) + '</strong></div>' +
      '<div><span class="muted">latest:</span> ' + escHtml(latest) + '</div>' +
      '<div><span class="muted">difficulty:</span> ' + escHtml(a.difficulty || '-') + '</div>' +
      '<div><span class="muted">provider/model:</span> ' + escHtml(provider) + '</div>' +
      '<div><span class="muted">result:</span> ' + escHtml(success) + ' / ' + escHtml(mode) + '</div>' +
      '<div><span class="muted">timestamp:</span> ' + escHtml(ts) + '</div>' +
      '<div><span class="muted">recent log count:</span> ' + Number(a.recentCount || 0) + '</div>' +
    '</div>';
}

function renderProjects(projects) {
  if (!projects || !projects.length) return;
  const wrap = document.getElementById('projects');
  wrap.innerHTML = projects.map(p => {
    const ciClass = {success:'ci-success',failure:'ci-failure',pending:'ci-pending'}[p.ci.status] || 'ci-unknown';
    const ciLabel = {success:'CI ✓',failure:'CI ✗',pending:'CI …',unknown:'CI ?'}[p.ci.status] || 'CI ?';
    const gitRows = (p.gitLog || []).map(c =>
      \`<tr>
        <td class="git-hash">\${c.hash}</td>
        <td class="git-ts">\${fmtDate(c.ts)}</td>
        <td class="git-subject">\${escHtml(c.subject)}</td>
      </tr>\`
    ).join('');
    const cloudRunHtml = p.cloudRun ? '<div class="project-cost"><span class="muted">Cloud Run:</span> ' +
      (p.cloudRun.ready ? '<span style="color:#3fb950">● RUNNING</span>' : '<span style="color:#f85149">● STOPPED</span>') +
      (p.cloudRun.revision ? ' <span style="color:#8b949e">' + escHtml(p.cloudRun.revision) + '</span>' : '') +
      '</div>' : '';
    const schedHtml = p.scheduler ? '<div class="project-cost"><span class="muted">Scheduler:</span> ' +
      (p.scheduler.state === 'ENABLED' ? '<span style="color:#3fb950">● ENABLED</span>' : '<span style="color:#d29922">● ' + escHtml(p.scheduler.state) + '</span>') +
      (p.scheduler.schedule ? ' <span style="color:#8b949e">' + escHtml(p.scheduler.schedule) + ' ' + escHtml(p.scheduler.timeZone) + '</span>' : '') +
      '</div>' : '';
    return \`<div class="project-card">
  <div class="project-header">
    <div class="project-dot" style="background:\${p.color}"></div>
    <div class="project-title">\${escHtml(p.label)}</div>
    \${p.version ? '<span class="project-ver">v'+escHtml(p.version)+'</span>' : ''}
    <span class="ci-badge \${ciClass}">\${ciLabel}</span>
  </div>
  <div class="project-body">
    \${cloudRunHtml}
    \${schedHtml}
    <div class="project-cost">Cost: <strong>\${fmtUsd(p.cost && p.cost.totalUsd)}</strong>\${p.ci.name ? ' &nbsp;·&nbsp; '+escHtml(p.ci.name) : ''}</div>
    <table class="git-log">\${gitRows || '<tr><td style="color:#484f58">no commits</td></tr>'}</table>
  </div>
</div>\`;
  }).join('');
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderAgents(agents) {
  const wrap = document.getElementById('agents');
  wrap.innerHTML = Object.entries(agents).map(([key, a]) => {
    const c = a.color;
    const dotClass = 'dot-' + a.status;
    const statusClass = 'status-' + a.status;
    const statusText = a.status === 'active' ? 'Active' : a.status === 'recent' ? 'Recent' : 'Idle';
    const keyBadge = a.keyPresent
      ? '<span class="key-badge key-ok">KEY ✓</span>'
      : '<span class="key-badge key-missing">KEY —</span>';
    return \`<div class="agent-card \${a.status==='active'?'active':''}" style="--c:\${c}">
  <div class="agent-icon" style="color:\${c}">\${a.icon}</div>
  <div class="agent-label">\${a.label}</div>
  <div class="agent-model">\${a.model}</div>
  <span class="status-dot \${dotClass}"></span><span class="agent-status-text \${statusClass}">\${statusText}</span>
  <br>\${keyBadge}
  \${a.lastTs ? '<div style="margin-top:6px;font-size:9px;color:#484f58">Last: '+fmtTs(a.lastTs)+'</div>' : ''}
</div>\`;
  }).join('');
}

function renderCost(cost) {
  document.getElementById('cost-total').textContent = fmtUsd(cost.totalUsd);
  if (cost.claudeEstimateUsd > 0) {
    document.getElementById('cost-sub').textContent =
      'Claude equivalent: ' + fmtUsd(cost.claudeEstimateUsd) +
      '  ·  saving: ' + (cost.savingPct||0) + '%';
  }
  const bp = cost.byProvider || {};
  const max = Math.max(...Object.values(bp), 0.000001);
  document.getElementById('cost-bars').innerHTML = Object.entries(bp).map(([p, v]) => {
    const pct = Math.round((v / max) * 100);
    const color = PROVIDER_BAR_COLOR[p] || '#8b949e';
    return \`<div class="cost-row">
  <span class="cost-label">\${p}</span>
  <div class="cost-bar-wrap"><div class="cost-bar" style="width:\${pct}%;background:\${color}"></div></div>
  <span class="cost-val">\${fmtUsd(v)}</span>
</div>\`;
  }).join('');
  if (cost.savingPct > 0) {
    document.getElementById('saving-box').innerHTML =
      \`<div class="saving-box">💰 vs Claude Agent Team: \${fmtUsd(cost.claudeEstimateUsd - cost.totalUsd)} saved (\${cost.savingPct}%)</div>\`;
  }
}

function renderWorkLog(entries) {
  document.getElementById('work-log').innerHTML = entries.slice(0, 20).map(e => {
    const c = AGENT_COLORS[e.role] || '#8b949e';
    const icon = {gemini:'G', gpt:'P', claude:'C', grok:'X', human:'H'}[e.role] || '?';
    const desc = (e.description || '').slice(0, 55);
    const task = e.taskId ? e.taskId.slice(0, 10) : '';
    return \`<div class="log-row">
  <span class="log-ts">\${fmtTs(e.ts || (e.meta&&e.meta.ts))}</span>
  <span class="log-icon" style="background:\${c}">\${icon}</span>
  <span class="log-action">\${(e.action||'').slice(0,10)}</span>
  <span class="log-desc">\${escHtml(desc)}</span>
  <span class="log-task">\${task}</span>
</div>\`;
  }).join('');
}

function applyState(state) {
  document.getElementById('dash-ver').textContent = state.version || '-';
  document.getElementById('mode-badge').innerHTML = state.demo
    ? '<span class="badge badge-dry">DEMO / DRY-RUN</span>'
    : state.dryRun
      ? '<span class="badge badge-dry">DRY-RUN</span>'
      : '<span class="badge badge-live">LIVE</span>';
  document.getElementById('updated').textContent =
    'Updated: ' + new Date(state.ts).toLocaleTimeString('ja-JP');
  renderAutoRecording(state.autoRecording || {});
  renderProjects(state.projects || []);
  renderAgents(state.agents || {});
  renderCost(state.cost || {});
  renderWorkLog(state.workLog || []);
}

// ── SSE connection ────────────────────────────────────────────────────────────
const es = new EventSource('/api/events');
es.addEventListener('state', e => { try { applyState(JSON.parse(e.data)); } catch(_){} });
es.onerror = () => {
  setTimeout(() => fetch('/api/state').then(r=>r.json()).then(applyState).catch(()=>{}), 5000);
};

fetch('/api/state').then(r=>r.json()).then(applyState).catch(()=>{});
</script>
</body>
</html>`;
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const SSE_CLIENTS = new Set();

function sseHeaders() {
  return {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'Access-Control-Allow-Origin': '*',
  };
}

function sendSseState(res, state) {
  const data = JSON.stringify(state);
  res.write(`event: state\ndata: ${data}\n\n`);
}

function broadcast(state) {
  for (const res of SSE_CLIENTS) {
    try { sendSseState(res, state); } catch (_) { SSE_CLIENTS.delete(res); }
  }
}

function startServer(port, opts = {}) {
  const { dryRun = true } = opts;

  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];

    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderHtml());
      return;
    }

    if (url === '/api/state') {
      const state = buildDashboardState({ dryRun });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(state));
      return;
    }

    if (url === '/api/events') {
      res.writeHead(200, sseHeaders());
      res.write(': connected\n\n');
      SSE_CLIENTS.add(res);
      const state = buildDashboardState({ dryRun });
      sendSseState(res, state);
      req.on('close', () => SSE_CLIENTS.delete(res));
      return;
    }

    if (url === '/api/state/push' && req.method === 'POST') {
      let body = '';
      req.on('data', d => { body += d; });
      req.on('end', () => {
        try {
          const patch = JSON.parse(body);
          const dir = path.dirname(STATE_FILE);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const current = readStateFile() || buildDashboardState({ dryRun });
          const next = { ...current, ...patch, ts: new Date().toISOString() };
          if (!dryRun) fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
          broadcast(next);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, dryRun }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  // Push fresh state every 10 s (CI fetch is slow, avoid hammering gh API)
  const ticker = setInterval(() => {
    if (SSE_CLIENTS.size > 0) {
      broadcast(buildDashboardState({ dryRun }));
    }
  }, 10_000);
  ticker.unref();

  server.listen(port, () => {
    console.log(`\n  ⬡  KOSAME Multi-Project Dashboard  →  http://localhost:${port}`);
    console.log(`     Projects: ${PROJECTS.map(p => p.key).join(', ')}`);
    console.log(`     dryRun: ${dryRun}  |  state file: ${fs.existsSync(STATE_FILE) ? 'found' : 'demo mode'}`);
    console.log(`     Cloud Shell preview: https://shell.cloud.google.com  (port ${port})\n`);
  });

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`  ERROR: port ${port} already in use. Try --port=<other>`);
      process.exit(1);
    }
    throw err;
  });

  return server;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  let port   = 8080;
  let dryRun = true;
  for (const a of args) {
    if (a.startsWith('--port=')) port   = parseInt(a.slice(7), 10);
    if (a === '--live')          dryRun = false;
    if (a === '--write')         dryRun = false;
  }
  return { port, dryRun };
}

if (require.main === module) {
  const { port, dryRun } = parseArgs(process.argv);
  startServer(port, { dryRun });
}

module.exports = {
  TOOL_META,
  PROJECTS,
  REGISTRY_FILE,
  loadDynamicProjects,
  getEffectiveProjects,
  buildProjectState,
  buildDashboardState,
  renderHtml,
  startServer,
  parseArgs,
};
