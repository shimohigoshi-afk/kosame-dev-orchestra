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
  version: '110.45.0',
  feature: 'v110-45-hybrid-wsl-relay',
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

function getGcloudConfigDir() {
  const env = process['env'];
  return env.CLOUDSDK_CONFIG || path.join(os.homedir(), '.config', 'gcloud');
}

function canReadGcloudStatus() {
  const env = process['env'];
  if (env.KOSAME_DASHBOARD_GCLOUD_STATUS_DISABLED === '1') return false;
  if (env.CI === 'true' || env.GITHUB_ACTIONS === 'true') return false;
  if (!process.stdout.isTTY || !process.stdin.isTTY) return false;

  const configDir = getGcloudConfigDir();
  const configParent = path.dirname(configDir);
  try {
    fs.accessSync(configParent, fs.constants.W_OK);
    return true;
  } catch (_) {
    return false;
  }
}

function buildUnavailableCloudRunStatus(reason = 'not_authenticated') {
  return {
    status: 'warning',
    availability: 'unavailable',
    reason,
    url: '',
    ready: false,
    revision: '',
    version: '',
  };
}

function buildUnavailableSchedulerStatus(reason = 'not_authenticated') {
  return {
    status: 'warning',
    availability: 'unavailable',
    reason,
    schedule: '',
    timeZone: '',
    state: 'unavailable',
    lastRun: '',
    nextRun: '',
  };
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
  if (!canReadGcloudStatus()) {
    return buildUnavailableCloudRunStatus('not_authenticated');
  }
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
  } catch (err) {
    const msg = String(err && (err.stderr || err.message || err)).toLowerCase();
    const reason = /reauth|auth|credential|login|token|permission|unauthori/.test(msg)
      ? 'not_authenticated'
      : 'unavailable';
    return buildUnavailableCloudRunStatus(reason);
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
  if (!canReadGcloudStatus()) {
    return buildUnavailableSchedulerStatus('not_authenticated');
  }
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
  } catch (err) {
    const msg = String(err && (err.stderr || err.message || err)).toLowerCase();
    const reason = /reauth|auth|credential|login|token|permission|unauthori/.test(msg)
      ? 'not_authenticated'
      : 'unavailable';
    return buildUnavailableSchedulerStatus(reason);
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

  const relayNow = Date.now();
  const relayAge = RELAY.lastEventTs ? relayNow - RELAY.lastEventTs : Infinity;
  const relayStatus = RELAY.lastEventTs === 0 ? 'offline'
                     : relayAge < 15000          ? 'online'
                     : relayAge < 60000          ? 'delayed'
                     : 'offline';

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
    relay: {
      status:        relayStatus,
      lastEventTs:   RELAY.lastEventTs,
      eventCount:    RELAY.eventCount,
      lastEventType: RELAY.lastEventType,
      lastTaskId:    RELAY.lastTaskId,
      activeTaskIds: [...RELAY.activeTaskIds],
    },
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

  /* Activity / Live Progress */
  .activity-card{background:#161b22;border:1px solid #30363d;border-radius:6px;margin-bottom:14px;overflow:hidden}
  .activity-header{background:#1c2333;padding:8px 14px;font-size:11px;color:#8b949e;border-bottom:1px solid #21262d;letter-spacing:1px}
  .activity-body{padding:12px 14px}
  .activity-row{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px;border-bottom:1px solid #161b22}
  .activity-row:last-child{border-bottom:none}
  .activity-ev{margin:0;padding:0}
  .activity-ev a{color:#58a6ff;text-decoration:none}
  .status-work{color:#58a6ff}
  .status-done{color:#3fb950}
  .status-fail{color:#f85149}
  .status-gate{color:#d29922}
  .status-idle{color:#484f58}
  .mission-box{display:flex;gap:16px;flex-wrap:wrap;align-items:center}
  .mission-item{font-size:11px}
  .mission-item strong{color:#e6edf3;font-size:12px}
  .mission-label{color:#8b949e;font-size:10px}
  .progress-wrap{width:120px;height:4px;background:#21262d;border-radius:2px;overflow:hidden}
  .progress-bar{height:100%;border-radius:2px;transition:width .5s}

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

<div class="activity-card" id="auto-recording-card" style="margin-bottom:14px">
  <div class="project-header">
    <span class="project-dot" style="background:#58a6ff"></span>
    <strong>Auto Recording</strong>
  </div>
  <div class="project-body" id="auto-recording">
    <div class="muted">loading...</div>
  </div>
</div>

<div class="activity-card" id="live-mission-card" style="margin-bottom:14px">
  <div class="activity-header">⬡ CURRENT MISSION <span id="relay-badge" style="float:right;font-size:10px"></span></div>
  <div class="activity-body" id="live-mission">
    <div class="muted">no active mission</div>
  </div>
</div>
<div class="activity-card" style="margin-bottom:14px;background:#0d1b2a">
  <div class="activity-header" style="background:#0d1b2a;color:#58a6ff">⬡ EXECUTION SOURCE</div>
  <div class="activity-body" id="relay-status">
    <div class="muted">waiting for WSL relay...</div>
  </div>
</div>

<div class="activity-card" id="activity-log-card" style="margin-bottom:14px">
  <div class="activity-header">⬡ ACTIVITY LOG</div>
  <div class="activity-body" id="activity-log">
    <div class="muted">no activity yet</div>
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
    const cloudRunState = p.cloudRun?.availability === 'unavailable'
      ? '<span style="color:#d29922">● UNAVAILABLE</span>'
      : p.cloudRun?.ready
        ? '<span style="color:#3fb950">● RUNNING</span>'
        : '<span style="color:#f85149">● STOPPED</span>';
    const cloudRunHtml = p.cloudRun ? '<div class="project-cost"><span class="muted">Cloud Run:</span> ' +
      cloudRunState +
      (p.cloudRun.revision ? ' <span style="color:#8b949e">' + escHtml(p.cloudRun.revision) + '</span>' : '') +
      (p.cloudRun.reason ? ' <span style="color:#d29922">(' + escHtml(p.cloudRun.reason) + ')</span>' : '') +
      '</div>' : '';
    const schedState = p.scheduler?.availability === 'unavailable'
      ? '<span style="color:#d29922">● UNAVAILABLE</span>'
      : p.scheduler.state === 'ENABLED'
        ? '<span style="color:#3fb950">● ENABLED</span>'
        : '<span style="color:#d29922">● ' + escHtml(p.scheduler.state) + '</span>';
    const schedHtml = p.scheduler ? '<div class="project-cost"><span class="muted">Scheduler:</span> ' +
      schedState +
      (p.scheduler.reason ? ' <span style="color:#d29922">(' + escHtml(p.scheduler.reason) + ')</span>' : '') +
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

function renderRelayStatus(relay) {
  const wrap = document.getElementById('relay-status');
  const badge = document.getElementById('relay-badge');
  if (!wrap) return;
  if (!relay || relay.status === 'offline' && relay.eventCount === 0) {
    wrap.innerHTML = '<div class="muted">waiting for WSL relay...</div>';
    if (badge) badge.innerHTML = '';
    return;
  }
  const statusColor = relay.status === 'online' ? '#3fb950'
    : relay.status === 'delayed' ? '#d29922' : '#f85149';
  const statusLabel = relay.status === 'online' ? 'ONLINE'
    : relay.status === 'delayed' ? 'DELAYED' : 'OFFLINE';
  const lastTs = relay.lastEventTs
    ? new Date(relay.lastEventTs).toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit',second:'2-digit'})
    : '--';
  const tasks = (relay.activeTaskIds || []).join(', ') || '(none)';
  wrap.innerHTML =
    '<div style="padding:8px 14px;font-size:11px">' +
    '<div><span class="muted">source:</span> <strong>WSL (PowerShell Launcher)</strong></div>' +
    '<div><span class="muted">relay status:</span> <span style="color:' + statusColor + '">● ' + statusLabel + '</span></div>' +
    '<div><span class="muted">events relayed:</span> ' + (relay.eventCount || 0) + '</div>' +
    '<div><span class="muted">active tasks:</span> ' + escHtml(tasks) + '</div>' +
    '<div><span class="muted">last event:</span> ' + escHtml(relay.lastEventType || '') + ' at ' + lastTs + '</div>' +
    '</div>';
  if (badge) {
    badge.innerHTML = '<span style="color:' + statusColor + '">● ' + statusLabel + '</span>';
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

// ── Activity event rendering ──────────────────────────────────────────────────

const EVENT_COLORS = {
  task_started:'#58a6ff', agent_assigned:'#58a6ff', agent_started:'#58a6ff',
  file_read:'#8b949e', file_changed:'#58a6ff',
  verify_started:'#d29922', verify_passed:'#3fb950', verify_failed:'#f85149',
  repair_started:'#d29922',
  review_started:'#d29922', review_passed:'#3fb950', review_failed:'#f85149',
  fallback_started:'#d29922',
  human_gate:'#d29922',
  task_completed:'#3fb950', task_failed:'#f85149',
};

function renderMission(events) {
  const wrap = document.getElementById('live-mission');
  if (!wrap) return;
  // Find the latest event for the most recent unique taskId
  const taskIds = [...new Set(events.filter(e => e.taskId).map(e => e.taskId))];
  const latestTaskId = taskIds[0]; // most recent unique task
  const active = latestTaskId ? events.find(e => e.taskId === latestTaskId) : events[events.length - 1];
  if (!active || !active.taskId) {
    wrap.innerHTML = '<div class="muted">no active mission</div>';
    return;
  }
  const pct = active.progressPercent != null ? active.progressPercent : 0;
  const elapsed = active.elapsedMs ? (active.elapsedMs / 1000).toFixed(0) + 's' : '-';
  const mode = active.dryRun ? 'dryRun' : 'live';
  const evClass = {task_failed:'status-fail',task_completed:'status-done',human_gate:'status-gate'}[active.eventType] || 'status-work';
  wrap.innerHTML =
    '<div class="mission-box">' +
      '<div class="mission-item"><span class="mission-label">project</span><br><strong>' + escHtml(active.project||'-') + '</strong></div>' +
      '<div class="mission-item"><span class="mission-label">agent</span><br><strong>' + escHtml(active.agent||active.model||'-') + '</strong></div>' +
      '<div class="mission-item"><span class="mission-label">stage</span><br><strong>' + escHtml(active.stage||active.eventType||'-') + '</strong></div>' +
      '<div class="mission-item"><span class="mission-label">file</span><br><strong>' + escHtml(active.currentFile||'-') + '</strong></div>' +
      '<div class="mission-item"><span class="mission-label">progress</span><br><div class="progress-wrap"><div class="progress-bar" style="width:'+pct+'%;background:#58a6ff"></div></div></div>' +
      '<div class="mission-item"><span class="mission-label">' + pct + '% / ' + elapsed + '</span></div>' +
      '<div class="mission-item"><span class="mission-label">mode</span><br><span class="' + evClass + '">' + mode + '</span></div>' +
    '</div>' +
    '<div style="margin-top:6px;font-size:10px;color:#8b949e">' + escHtml(active.message||'') + '</div>' +
    '<div style="margin-top:2px;font-size:10px;color:#484f58">last: ' + fmtTs(active.timestamp) + '</div>';
}

function renderActivityLog(events) {
  const wrap = document.getElementById('activity-log');
  if (!wrap) return;
  if (!events || events.length === 0) {
    wrap.innerHTML = '<div class="muted">no activity yet</div>';
    return;
  }
  wrap.innerHTML = events.slice(0, 50).map(e => {
    const c = EVENT_COLORS[e.eventType] || '#8b949e';
    const evClass = e.eventType === 'task_failed' ? 'status-fail'
      : e.eventType === 'task_completed' || e.eventType === 'review_passed' || e.eventType === 'verify_passed' ? 'status-done'
      : e.eventType === 'human_gate' ? 'status-gate'
      : e.eventType === 'verify_failed' || e.eventType === 'review_failed' ? 'status-fail'
      : 'status-work';
    const icon = {task_started:'▶',task_decomposed:'◇',agent_assigned:'@',agent_started:'→',file_read:'📄',file_changed:'✏',
      verify_started:'🔍',verify_passed:'✓',verify_failed:'✗',repair_started:'🔧',review_started:'👁',review_passed:'★',review_failed:'✗',
      fallback_started:'↷',human_gate:'⛔',task_completed:'✅',task_failed:'❌'}[e.eventType] || '·';
    const msg = (e.message || '').slice(0, 60);
    const ts = fmtTs(e.timestamp);
    return '<div class="activity-row">' +
      '<span style="color:' + c + ';width:16px;flex-shrink:0">' + icon + '</span>' +
      '<span class="activity-ev" style="color:' + c + '">' + escHtml(e.eventType) + '</span>' +
      '<span style="color:#8b949e;width:60px;flex-shrink:0">' + ts + '</span>' +
      '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(msg) + '</span>' +
    '</div>';
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
  renderRelayStatus(state.relay || {});
  renderProjects(state.projects || []);
  renderAgents(state.agents || {});
  renderCost(state.cost || {});
  renderWorkLog(state.workLog || []);
}

// ── SSE connections ───────────────────────────────────────────────────────────
const es = new EventSource('/api/events');
es.addEventListener('state', e => { try { applyState(JSON.parse(e.data)); } catch(_){} });
es.onerror = () => {
  setTimeout(() => fetch('/api/state').then(r=>r.json()).then(applyState).catch(()=>{}), 5000);
};

fetch('/api/state').then(r=>r.json()).then(applyState).catch(()=>{});

// ── Activity SSE ──────────────────────────────────────────────────────────────
const activityLog = [];
const aes = new EventSource('/api/activity/stream');
aes.addEventListener('activity', e => {
  try {
    const ev = JSON.parse(e.data);
    activityLog.unshift(ev);
    if (activityLog.length > 100) activityLog.length = 100;
    renderMission(activityLog);
    renderActivityLog(activityLog);
  } catch(_) {}
});
aes.onerror = () => {
  setTimeout(() => {
    fetch('/api/activity').then(r=>r.json()).then(entries => {
      activityLog.length = 0;
      entries.forEach(e => activityLog.push(e));
      renderMission(activityLog);
      renderActivityLog(activityLog);
    }).catch(()=>{});
  }, 5000);
};

// Initial activity fetch
fetch('/api/activity').then(r=>r.json()).then(entries => {
  entries.forEach(e => activityLog.push(e));
  renderMission(activityLog);
  renderActivityLog(activityLog);
}).catch(()=>{});
</script>
</body>
</html>`;
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const SSE_CLIENTS = new Set();

// ── WSL relay status (in-memory, reset on dashboard restart) ────────────────
const RELAY = {
  lastEventTs: 0,
  eventCount:  0,
  lastEventType: '',
  lastTaskId:   '',
  activeTaskIds: new Set(),
  // ingest eventId dedup (process lifetime)
  _seenEventIds: new Set(),
};

// ── Discord notification on ingest terminal events ──────────────────────────
function notifyDiscordOnIngest(event) {
  const _proc = typeof process !== 'undefined' ? process : null;
  const _e = _proc ? _proc['env'] : null;
  const dUrl = _e ? (_e['DISCORD_WEBHOOK_URL'] || '') : '';
  if (!dUrl) return;
  try {
    const { notify } = require('./real-time-progress-notifier');
    const eventLabel = event.eventType === 'task_completed' ? 'done'
                     : event.eventType === 'task_failed'    ? 'error'
                     : 'human_gate';
    const msg = `[WSL] ${event.project || event.taskId || ''} — ${event.eventType}`;
    notify(eventLabel, { message: msg, detail: (event.message || '').slice(0, 100) }, { discord: { url: dUrl } }, { dryRun: true, silent: true }).catch(() => {});
  } catch (_) {}
}

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

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      });
      return res.end();
    }

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

    if (url === '/api/activity') {
      const { getLatest } = require('./kosame-activity-events');
      getLatest(50).then(entries => {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(entries));
      }).catch(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('[]');
      });
      return;
    }

    if (url === '/api/activity/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      const { addSseClient, getLatest } = require('./kosame-activity-events');
      addSseClient(res);

      // Send recent history on connect
      getLatest(20).then(entries => {
        for (const entry of entries.reverse()) {
          try { res.write(`event: activity\ndata: ${JSON.stringify(entry)}\n\n`); } catch (_) {}
        }
      });

      // Keepalive
      const keepalive = setInterval(() => {
        try { res.write(': keepalive\n\n'); } catch (_) { clearInterval(keepalive); }
      }, 15000);

      req.on('close', () => {
        clearInterval(keepalive);
        const { removeSseClient } = require('./kosame-activity-events');
        removeSseClient(res);
      });
      return;
    }

    // ── Activity ingest (WSL relay → Cloud Run) ──────────────────────────
    if (url === '/api/activity/ingest' && req.method === 'POST') {
      const { checkAuth } = require('./kosame-dev-run-api');
      if (!checkAuth(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
      }
      let body = '';
      req.on('data', d => { body += d; if (body.length > 200_000) req.destroy(); });
      req.on('end', () => {
        let event;
        try { event = JSON.parse(body); } catch (_) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: 'invalid JSON' }));
        }
        if (!event.eventId || !event.eventType) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: 'eventId and eventType required' }));
        }
        if (RELAY._seenEventIds.has(event.eventId)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: true, dedup: true }));
        }
        RELAY._seenEventIds.add(event.eventId);
        if (RELAY._seenEventIds.size > 10000) {
          const iter = RELAY._seenEventIds.values();
          RELAY._seenEventIds.delete(iter.next().value);
        }
        RELAY.lastEventTs   = Date.now();
        RELAY.eventCount++;
        RELAY.lastEventType = event.eventType;
        RELAY.lastTaskId    = event.taskId || '';
        if (event.taskId) RELAY.activeTaskIds.add(event.taskId);
        if (event.eventType === 'task_completed' || event.eventType === 'task_failed') {
          RELAY.activeTaskIds.delete(event.taskId || '');
        }

        const { rebroadcast, appendToLog } = require('./kosame-activity-events');
        rebroadcast(event);
        appendToLog(event);

        // Discord notification for terminal events
        if (event.eventType === 'task_completed' || event.eventType === 'task_failed' || event.eventType === 'human_gate') {
          notifyDiscordOnIngest(event);
        }

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, eventId: event.eventId }));
      });
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

    // ── Dev Run API routes (v110.45 hybrid: WSL relay, no Cloud Run exec) ─
    if (url.startsWith('/api/dev/') || url === '/health') {
      const { checkAuth, getDevRunState, TOOL_META: DEV_META } = require('./kosame-dev-run-api');

      if (url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, version: TOOL_META.version, dryRun }));
        return;
      }

      if (!checkAuth(req)) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer realm="KOSAME Dev Run API"',
        });
        res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
        return;
      }

      if (url === '/api/dev/run' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          ok: false,
          code: 'REMOTE_EXECUTION_UNAVAILABLE',
          message: 'auto-dev execution is not available on Cloud Run. Use WSL launcher:',
          wslCommand: 'powershell -File tools/Invoke-KosameAutoDev.ps1 -SpecFile "<spec>" -Project "<project>"',
          docs: 'https://github.com/shimohigoshi-afk/kosame-dev-orchestra#v11045-hybrid-wsl',
          relay: {
            status:        RELAY.lastEventTs === 0 ? 'offline' : 'online',
            lastEventTs:   RELAY.lastEventTs,
            eventCount:    RELAY.eventCount,
            activeTaskIds: [...RELAY.activeTaskIds],
          },
        }));
        return;
      }

      if (url === '/api/dev/status') {
        const state = getDevRunState();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          ok: true,
          running:   state.running,
          runId:     state.runId,
          elapsedMs: state.elapsedMs,
          dryRun,
          version:   DEV_META.version,
          relay: {
            status:        RELAY.lastEventTs === 0 ? 'offline' : 'online',
            lastEventTs:   RELAY.lastEventTs,
            eventCount:    RELAY.eventCount,
            activeTaskIds: [...RELAY.activeTaskIds],
          },
        }));
        return;
      }

      // GET /api/dev/status/:taskId — per-task state from JSONL store
      const statusMatch = url.match(/^\/api\/dev\/status\/(.+)$/);
      if (statusMatch) {
        const taskId = decodeURIComponent(statusMatch[1]);
        const { getTaskState } = require('./kosame-activity-events');
        getTaskState(taskId).then(state => {
          if (!state) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: false, error: 'task not found', taskId }));
          }
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, taskId, state }));
        }).catch(() => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'internal error' }));
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'not found' }));
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

  // Watch activity JSONL for events from external processes (e.g. kosame-dev-run-api subprocess).
  // rebroadcast() pushes to /api/activity/stream SSE clients without re-writing to JSONL.
  const { watchLog, rebroadcast: rebroadcastActivity } = require('./kosame-activity-events');
  const stopActivityWatch = watchLog(event => rebroadcastActivity(event));
  server.on('close', stopActivityWatch);

  try {
    server.listen(port, () => {
      console.log(`\n  ⬡  KOSAME Multi-Project Dashboard  →  http://localhost:${port}`);
      console.log(`     Projects: ${PROJECTS.map(p => p.key).join(', ')}`);
      console.log(`     dryRun: ${dryRun}  |  state file: ${fs.existsSync(STATE_FILE) ? 'found' : 'demo mode'}`);
      console.log(`     Cloud Shell preview: https://shell.cloud.google.com  (port ${port})\n`);
    });
  } catch (err) {
    if (err && err.code === 'EPERM') {
      server.listenUnavailable = true;
      console.warn('  WARN: dashboard listen unavailable in this environment; running read-only without local socket');
      return server;
    }
    throw err;
  }

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`  ERROR: port ${port} already in use. Try --port=<other>`);
      process.exit(1);
    }
    if (err.code === 'EPERM') {
      server.listenUnavailable = true;
      console.warn('  WARN: dashboard listen unavailable in this environment; running read-only without local socket');
      return;
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
