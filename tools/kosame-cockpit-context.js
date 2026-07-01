#!/usr/bin/env node
'use strict';

const { buildWorkOrderResultDecision, summarizeDecision } = require('./kosame-work-order-result-decision');
const { summarizeOrchestraEvidence } = require('./kosame-orchestra-evidence');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function countList(value) {
  return Array.isArray(value) ? value.length : 0;
}

function firstLine(value) {
  const text = normalizeText(value);
  if (!text) return '—';
  return text.split(/\r?\n/).find(Boolean) || '—';
}

function summarizeProject(project) {
  if (!project || typeof project !== 'object') return null;
  const title = normalizeText(project.statusTitle || project.shortName || project.name || project.id);
  if (!title) return null;
  const status = normalizeText(project.health || project.availability || 'unknown');
  const branch = firstLine(Array.isArray(project.statusLines) ? project.statusLines[0] : '');
  const changed = countList(project.changedFiles);
  const staged = countList(project.stagedFiles);
  const commit = firstLine(Array.isArray(project.recentCommits) && project.recentCommits.length ? project.recentCommits[0].raw : '').replace(/\.env\b/gi, '[env]');
  const actions = firstLine(Array.isArray(project.githubActions) && project.githubActions.length ? project.githubActions[0] : '').replace(/\.env\b/gi, '[env]');
  return `${title}: ${status}; status=${branch}; changed=${changed}; staged=${staged}; latestCommit=${commit}; actions=${actions}`;
}

function summarizeCost(apiCost) {
  const cost = apiCost && typeof apiCost === 'object' ? apiCost : {};
  const total = cost.total || {};
  return [
    `session=${normalizeText(total.sessionUsd != null ? `$${Number(total.sessionUsd).toFixed(4)}` : '') || '—'}`,
    `today=${normalizeText(total.todayUsd != null ? `$${Number(total.todayUsd).toFixed(4)}` : '') || '—'}`,
    `month=${normalizeText(total.monthUsd != null ? `$${Number(total.monthUsd).toFixed(4)}` : '') || '—'}`,
    `unknown=${Number(cost.unknownUsageCount || total.unknownCount || 0)}`,
  ].join(' / ');
}

function summarizeTaskFeeder(taskFeeder) {
  const feeder = taskFeeder && typeof taskFeeder === 'object' ? taskFeeder : {};
  const base = [
    `selected=${countList(feeder.selectedTasks)}`,
    `ready=${Number(feeder.readyTaskCount || 0)}`,
    `blocked=${Number(feeder.blockedCount || 0)}`,
    `humanGate=${Number(feeder.humanGateWaitingCount || 0)}`,
  ].join(' / ');

  const selectedTasks = Array.isArray(feeder.selectedTasks) ? feeder.selectedTasks : [];
  if (!selectedTasks.length) return base;

  const taskLines = selectedTasks.slice(0, 3).map((t) => {
    const title = normalizeText(t.title || t.taskId || '');
    if (!title) return null;
    const parts = [title];
    const project = normalizeText(t.project || t.relatedProject || '');
    if (project) parts.push(`project=${project}`);
    const ver = normalizeText(t.relatedVersion || '');
    if (ver) parts.push(`version=${ver}`);
    const priority = normalizeText(t.priority || '');
    if (priority) parts.push(`priority=${priority}`);
    return parts.join(' / ');
  }).filter(Boolean);

  if (!taskLines.length) return base;
  return `${base}; nextCandidates=[${taskLines.join(' | ')}]`;
}

function summarizeWishlist(wishlist) {
  const list = wishlist && typeof wishlist === 'object' ? wishlist : {};
  const base = [
    `pending=${Number(list.pendingCount || 0)}`,
    `suggested=${Number(list.suggestedCount || 0)}`,
    `later=${countList(list.laterIdeas)}`,
    `total=${Number(list.totalCount || 0)}`,
  ].join(' / ');

  const laterIdeas = Array.isArray(list.laterIdeas) ? list.laterIdeas : [];
  if (!laterIdeas.length) return base;

  const ideaTitles = laterIdeas.slice(0, 3).map((idea) => {
    if (typeof idea === 'string') return normalizeText(idea);
    return normalizeText(idea && (idea.title || idea.wishlistId || idea.id || '') || '');
  }).filter(Boolean);

  if (!ideaTitles.length) return base;
  return `${base}; laterIdeas=[${ideaTitles.join(' | ')}]`;
}

function summarizeMemoryVault(memoryVault) {
  const memory = memoryVault && typeof memoryVault === 'object' ? memoryVault : {};
  const work = memory.workMemory || {};
  const state = memory.stateMemory || {};
  const wishlist = memory.wishlistMemory || {};
  const handoff = memory.handoff || {};
  return [
    `status=${normalizeText(memory.status || 'unknown')}`,
    `work=${Number(work.count || 0)}(${normalizeText(work.status || 'unknown')})`,
    `stateUpdated=${normalizeText(state.lastUpdatedAt || '—')}`,
    `wishlist=${Number(wishlist.count || 0)}`,
    `handoff=${handoff.exists ? 'exists' : 'missing'}`,
    `warnings=${Number(memory.warningCount || 0)}`,
  ].join(' / ');
}

function summarizeWorkOrderHandoff(workOrder) {
  const handoff = workOrder && typeof workOrder === 'object' ? workOrder : {};
  const title = normalizeText(handoff.title || handoff.safe_prompt_summary || '');
  const status = normalizeText(handoff.status || 'unknown');
  const repo = normalizeText(handoff.target_repo || '');
  const agent = normalizeText(handoff.assigned_agent || handoff.recommended_agent || '');
  const risk = normalizeText(handoff.risk_level || '');
  const humanGate = handoff.human_gate_required === false ? 'optional' : 'required';
  const parts = [
    `status=${status || 'unknown'}`,
    `repo=${repo || '—'}`,
    `agent=${agent || '—'}`,
    `risk=${risk || '—'}`,
    `humanGate=${humanGate}`,
  ];
  if (title) parts.push(`title=${title}`);
  return parts.join(' / ');
}

function summarizeWorkOrderResult(workOrderResult) {
  const result = workOrderResult && typeof workOrderResult === 'object' ? workOrderResult : {};
  const status = normalizeText(result.result_status || result.work_order_status || 'unknown');
  const smoke = normalizeText(result.smoke_result || 'unknown');
  const verify = normalizeText(result.verify_result || 'unknown');
  const next = normalizeText(result.nextRecommendedAction || 'review');
  const executor = normalizeText(result.executor || result.assigned_agent || 'Codex');
  const route = normalizeText(result.route || 'zero-confirm');
  const resultPost = normalizeText(result.result_post || result.resultPOST || 'POST /api/work-orders/result 200');
  const executionHost = normalizeText(result.execution_host || result.executionHost || '—');
  const executionHostAllowed = result.execution_host_allowed ?? result.executionHostAllowed;
  const interactiveHostBlocked = result.interactive_host_blocked ?? result.interactiveHostBlocked;
  const interactivePromptBlocked = result.interactive_prompt_blocked ?? result.interactivePromptBlocked;
  const noYesGateRuntime = result.no_yes_gate_runtime ?? result.noYesGateRuntime;
  const safeSpawnActive = result.safe_spawn_active ?? result.safeSpawnActive;
  const manualCodeUiAllowed = result.manual_code_ui_allowed ?? result.manualCodeUiAllowed;
  const officialRoute = normalizeText(result.official_route || result.officialRoute || 'Console → Handoff → Runner');
  const codexYesHellGuard = normalizeText(result.codex_yes_hell_guard || result.codexYesHellGuard || 'active') || 'active';
  const codexAutoApproveMode = normalizeText(result.codex_auto_approve_mode || result.codexAutoApproveMode || 'active') || 'active';
  const userYesRequired = result.user_yes_required ?? result.userYesRequired;
  const safetyStopGuard = normalizeText(result.safety_stop_guard || result.safetyStopGuard || 'active') || 'active';
  const promptOrigin = normalizeText(result.prompt_origin || result.promptOrigin || '');
  const blockedReason = normalizeText(result.blocked_reason || result.blockedReason || '');
  const yesCount = Number.isFinite(Number(result.yes_count ?? result.yesCount)) ? Number(result.yes_count ?? result.yesCount) : 0;
  const copyCount = Number.isFinite(Number(result.copy_count ?? result.copyCount)) ? Number(result.copy_count ?? result.copyCount) : 0;
  const humanWait = Number.isFinite(Number(result.human_wait ?? result.humanWait)) ? Number(result.human_wait ?? result.humanWait) : 0;
  const approvalCount = Number.isFinite(Number(result.approval_request_count ?? result.approvalRequestCount ?? result.yes_count ?? result.yesCount)) ? Number(result.approval_request_count ?? result.approvalRequestCount ?? result.yes_count ?? result.yesCount) : 0;
  const manualPasteCount = Number.isFinite(Number(result.manual_paste_count ?? result.manualPasteCount ?? result.copy_count ?? result.copyCount)) ? Number(result.manual_paste_count ?? result.manualPasteCount ?? result.copy_count ?? result.copyCount) : 0;
  const waitCount = Number.isFinite(Number(result.wait_request_count ?? result.waitRequestCount ?? result.human_wait ?? result.humanWait)) ? Number(result.wait_request_count ?? result.waitRequestCount ?? result.human_wait ?? result.humanWait) : 0;
  const autoApprovedCount = Number.isFinite(Number(result.auto_approved_count ?? result.autoApprovedCount)) ? Number(result.auto_approved_count ?? result.autoApprovedCount) : 0;
  const autoBlockedCount = Number.isFinite(Number(result.auto_blocked_count ?? result.autoBlockedCount)) ? Number(result.auto_blocked_count ?? result.autoBlockedCount) : 0;
  const retryCount = Number.isFinite(Number(result.retry_count ?? result.retryCount)) ? Number(result.retry_count ?? result.retryCount) : 0;
  const recovered = !!result.recovered;
  const changedFiles = Array.isArray(result.changed_files) ? result.changed_files.slice(0, 3).map((item) => normalizeText(item)).filter(Boolean) : [];
  const orchestraEvidence = result.orchestra_evidence && typeof result.orchestra_evidence === 'object'
    ? summarizeOrchestraEvidence(result.orchestra_evidence)
    : result.router_decision || result.routerDecision || result.assigned_lanes || result.lane_statuses
      ? summarizeOrchestraEvidence(result)
      : '';
  const parts = [
    `status=${status}`,
    `smoke=${smoke}`,
    `verify=${verify}`,
    `next=${next}`,
    `executor=${executor}`,
    `route=${route}`,
    `resultPOST=${resultPost}`,
    `executionHost=${executionHost}`,
    `executionHostAllowed=${executionHostAllowed !== false ? 'true' : 'false'}`,
    `interactiveHostBlocked=${interactiveHostBlocked ? 'true' : 'false'}`,
    `interactivePromptBlocked=${interactivePromptBlocked ? 'true' : 'false'}`,
    `noYesGateRuntime=${noYesGateRuntime !== false ? 'true' : 'false'}`,
    `safeSpawnActive=${safeSpawnActive !== false ? 'true' : 'false'}`,
    `manualCodeUiAllowed=${manualCodeUiAllowed ? 'true' : 'false'}`,
    `officialRoute=${officialRoute}`,
    `codexYesHellGuard=${codexYesHellGuard}`,
    `codexAutoApproveMode=${codexAutoApproveMode}`,
    `userYesRequired=${userYesRequired ? 'true' : 'false'}`,
    `safetyStopGuard=${safetyStopGuard}`,
    `承認要求回数=${approvalCount}`,
    `手動貼付回数=${manualPasteCount}`,
    `待機要求回数=${waitCount}`,
    `自動YES回数=${autoApprovedCount}`,
    `自動遮断回数=${autoBlockedCount}`,
    `retryCount=${retryCount}`,
    `recovered=${recovered ? 'yes' : 'no'}`,
  ];
  if (orchestraEvidence) parts.push(orchestraEvidence);
  if (promptOrigin) parts.push(`promptOrigin=${promptOrigin}`);
  if (blockedReason) parts.push(`blockedReason=${blockedReason}`);
  if (changedFiles.length) parts.push(`changed=${changedFiles.join(' | ')}`);
  const summary = normalizeText(result.result_summary || result.changed_files_summary || result.notes || '');
  if (summary) parts.push(`summary=${summary}`);
  return parts.join(' / ');
}

function summarizeWorkOrderDecision(workOrderDecision) {
  const decision = workOrderDecision && typeof workOrderDecision === 'object'
    ? workOrderDecision
    : buildWorkOrderResultDecision({
      latestWorkOrderResult: workOrderDecision || {},
    });
  return summarizeDecision(decision);
}

function summarizeOperationsBoard(board) {
  const current = board && typeof board === 'object' ? board : {};
  const orchestraEvidence = current.orchestra_evidence && typeof current.orchestra_evidence === 'object'
    ? summarizeOrchestraEvidence(current.orchestra_evidence)
    : current.routerDecision || current.router_decision || current.assignedLanes || current.assigned_lanes || current.laneStatuses || current.lane_statuses
      ? summarizeOrchestraEvidence(current)
      : '';
  return [
    `zero-confirm=${normalizeText(current.route || 'zero-confirm')}`,
    `executor=${normalizeText(current.executor || 'claude-zero-confirm')}`,
    `executionHost=${normalizeText(current.executionHost || current.execution_host || '—')}`,
    `executionHostAllowed=${current.executionHostAllowed !== false ? 'true' : 'false'}`,
    `interactiveHostBlocked=${current.interactiveHostBlocked ? 'true' : 'false'}`,
    `interactivePromptBlocked=${current.interactivePromptBlocked ? 'true' : 'false'}`,
    `noYesGateRuntime=${current.noYesGateRuntime !== false ? 'true' : 'false'}`,
    `safeSpawnActive=${current.safeSpawnActive !== false ? 'true' : 'false'}`,
    `manualCodeUiAllowed=${current.manualCodeUiAllowed ? 'true' : 'false'}`,
    `officialRoute=${normalizeText(current.officialRoute || current.official_route || 'Console → Handoff → Runner')}`,
    `codexYesHellGuard=${normalizeText(current.codexYesHellGuard || current.codex_yes_hell_guard || 'active') || 'active'}`,
    `codexAutoApproveMode=${normalizeText(current.codexAutoApproveMode || current.codex_auto_approve_mode || 'active') || 'active'}`,
    `userYesRequired=${current.userYesRequired ? 'true' : 'false'}`,
    `safetyStopGuard=${normalizeText(current.safetyStopGuard || current.safety_stop_guard || 'active') || 'active'}`,
    `policyKernel=${normalizeText(current.policyKernel || 'active')}`,
    `promptClassifier=${normalizeText(current.promptClassifier || 'active')}`,
    `autoResponder=${normalizeText(current.autoResponder || 'active')}`,
    `firewall=${normalizeText(current.firewall || 'active')}`,
    `safetyStopDetector=${normalizeText(current.safetyStopDetector || 'active')}`,
    `directSpawnAudit=${normalizeText(current.directSpawnAudit || 'PASS')}`,
    `startupAudit=${normalizeText(current.startupAudit || 'PASS')}`,
    `queueHealth=${normalizeText(current.queueHealth || 'ok')}`,
    `watcherStatus=${normalizeText(current.watcherStatus || 'unknown')}`,
    `resultPOST=${normalizeText(current.resultPOSTStatus || current.result_post || 'POST /api/work-orders/result 200')}`,
    `history=${Number(current.runHistoryCount || 0)}`,
    `blocked=${Number(current.blockedCount || 0)}`,
    `autoApproved=${Number(current.autoApprovedCount || 0)}`,
    `recovered=${Number(current.recoveredCount || 0)}`,
    `latestDecision=${normalizeText(current.latestDecision || 'wait_for_result')}`,
    `latestTag=${normalizeText(current.latestTag || '—')}`,
    `latestCommit=${normalizeText(current.latestCommit || '—')}`,
    orchestraEvidence,
  ].join(' / ');
}

function summarizeProjectStrip(projectStrip) {
  const items = Array.isArray(projectStrip) ? projectStrip : [];
  if (!items.length) return '—';
  return items.slice(0, 6).map((project) => {
    const title = normalizeText(project.statusTitle || project.shortName || project.name || project.id);
    const selected = project.selected ? '*' : '';
    const running = Number(project.runningCount || 0);
    const humanGate = Number(project.humanGateCount || 0);
    const warnings = Number(project.warningCount || 0);
    const updated = normalizeText(project.lastUpdatedLabel || project.lastUpdatedAt || '');
    return `${selected}${title}:${normalizeText(project.statusClass || project.health || 'unknown')} / run=${running} / gate=${humanGate} / warn=${warnings} / ${updated || '—'}`;
  }).join(' | ');
}

function summarizeAgentEventFeed(feed) {
  const eventFeed = feed && typeof feed === 'object' ? feed : {};
  const items = Array.isArray(eventFeed.items) ? eventFeed.items : [];
  const counts = eventFeed.counts || {};
  const countText = [
    `START=${counts.START || 0}`,
    `RUNNING=${counts.RUNNING || 0}`,
    `VERIFY=${counts.VERIFY || 0}`,
    `VERIFY_PASS=${counts.VERIFY_PASS || 0}`,
    `HUMAN_GATE=${counts.HUMAN_GATE || 0}`,
    `DONE=${counts.DONE || 0}`,
    `ERROR=${counts.ERROR || 0}`,
    `WAITING=${counts.WAITING || 0}`,
    `BLOCKED=${counts.BLOCKED || 0}`,
  ].join(' / ');
  const itemText = items.slice(0, 5).map((item) => {
    const kind = normalizeText(item.kind || 'RUNNING');
    const actor = normalizeText(item.actor || 'KOSAME');
    const message = firstLine(item.text || item.message || '');
    return `${kind}:${actor}:${message}`;
  }).filter(Boolean);
  return itemText.length ? `${countText}; items=[${itemText.join(' | ')}]` : countText;
}

function summarizeShellActivity(activity) {
  const shell = activity && typeof activity === 'object' ? activity : {};
  const items = Array.isArray(shell.items) ? shell.items : [];
  const counts = shell.counts || {};
  const countText = [
    `queued=${counts.queued || 0}`,
    `running=${counts.running || 0}`,
    `editing=${counts.editing || 0}`,
    `verifying=${counts.verifying || 0}`,
    `success=${counts.success || 0}`,
    `failed=${counts.failed || 0}`,
    `human_gate=${counts.human_gate || 0}`,
    `blocked=${counts.blocked || 0}`,
    `waiting=${counts.waiting || 0}`,
  ].join(' / ');
  const itemText = items.slice(0, 5).map((item) => {
    const agent = normalizeText(item.agent || 'Shell');
    const label = normalizeText(item.label || item.status || 'running');
    const message = firstLine(item.message || item.text || '');
    return `${agent}:${label}:${message}`;
  }).filter(Boolean);
  return itemText.length ? `${countText}; items=[${itemText.join(' | ')}]` : countText;
}

function buildConsoleContextSummary(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      status: 'unavailable',
      summary: '',
      lines: [],
      warnings: ['snapshot unavailable'],
    };
  }

  const lines = [];
  const warnings = [];

  const currentVersion = normalizeText(snapshot.currentVersion || snapshot.version || 'unknown');
  const packageVersion = normalizeText(snapshot.packageVersion || currentVersion || 'unknown');
  const latestTag = `v${packageVersion}`;
  const headCommit = normalizeText(snapshot.headCommit || 'unknown');
  lines.push(`KOSAME Console / version=${currentVersion} / mode=${normalizeText(snapshot.mode || 'Readonly')}`);
  lines.push(`currentVersion=${currentVersion}`);
  lines.push(`versionContext=package=${packageVersion} / tag=${latestTag} / head=${headCommit}`);
  if (snapshot.currentMission) {
    lines.push(`currentMission=${normalizeText(snapshot.currentMission)}`);
  }
  if (snapshot.projectRegistryPath) {
    lines.push(`projectRegistry=loaded`);
  }

  const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  if (projects.length) {
    const projectLines = projects
      .filter((project) => project && project.enabled !== false)
      .slice(0, 6)
      .map((project) => `${normalizeText(project.statusTitle || project.shortName || project.name || project.id)}:${normalizeText(project.health || project.availability || 'unknown')}`);
    if (projectLines.length) {
      lines.push(`projects=${projectLines.join(' | ')}`);
    }
  }

  const projectStrip = Array.isArray(snapshot.projectStrip)
    ? snapshot.projectStrip
    : Array.isArray(snapshot.projectStrip && snapshot.projectStrip.items)
      ? snapshot.projectStrip.items
      : [];
  if (projectStrip.length) {
    lines.push(`projectStrip=${summarizeProjectStrip(projectStrip)}`);
  }

  const dev = snapshot.devOrchestra || {};
  const sales = snapshot.salesDx || {};
  if (dev || sales) {
    lines.push(`devOrchestra=${summarizeProject(dev) || '—'}`);
    lines.push(`salesDx=${summarizeProject(sales) || '—'}`);
  }

  const monitored = Array.isArray(snapshot.monitoredRepos) ? snapshot.monitoredRepos : [];
  if (monitored.length) {
    const monitoredLine = monitored
      .map((repo) => summarizeProject(repo))
      .filter(Boolean)
      .join(' || ');
    if (monitoredLine) {
      lines.push(`monitored=${monitoredLine}`);
    }
  }

  const taskFeeder = snapshot.taskFeeder || {};
  if (taskFeeder) {
    lines.push(`taskFeeder=${summarizeTaskFeeder(taskFeeder)}`);
    if (Array.isArray(taskFeeder.warnings) && taskFeeder.warnings.length) {
      warnings.push(...taskFeeder.warnings.map((line) => normalizeText(line)).filter(Boolean));
    }
  }

  const wishlist = snapshot.wishlist || (snapshot.taskFeeder && snapshot.taskFeeder.wishlist) || {};
  if (wishlist) {
    lines.push(`wishlist=${summarizeWishlist(wishlist)}`);
  }

  const memoryVault = snapshot.memoryVault || {};
  if (memoryVault) {
    lines.push(`memoryVault=${summarizeMemoryVault(memoryVault)}`);
  }

  const latestHandoffWorkOrder = snapshot.latestHandoffWorkOrder || {};
  if (latestHandoffWorkOrder && Object.keys(latestHandoffWorkOrder).length) {
    lines.push(`handoffQueue=${summarizeWorkOrderHandoff(latestHandoffWorkOrder)}`);
  }

  const latestWorkOrderResult = snapshot.latestWorkOrderResult || {};
  if (latestWorkOrderResult && Object.keys(latestWorkOrderResult).length) {
    lines.push(`workOrderResult=${summarizeWorkOrderResult(latestWorkOrderResult)}`);
  }

  const latestWorkOrderDecision = snapshot.latestWorkOrderDecision || {};
  if (latestWorkOrderDecision && Object.keys(latestWorkOrderDecision).length) {
    lines.push(`workOrderDecision=${summarizeWorkOrderDecision(latestWorkOrderDecision)}`);
  } else if (latestWorkOrderResult && Object.keys(latestWorkOrderResult).length) {
    const decision = buildWorkOrderResultDecision({
      latestWorkOrderResult,
      latestHandoffWorkOrder: snapshot.latestHandoffWorkOrder || null,
      latestApprovedWorkOrder: snapshot.latestApprovedWorkOrder || null,
    });
    lines.push(`workOrderDecision=${summarizeWorkOrderDecision(decision)}`);
  }

  const agentEventFeed = snapshot.agentEventFeed || {};
  if (agentEventFeed) {
    lines.push(`agentEventFeed=${summarizeAgentEventFeed(agentEventFeed)}`);
  }

  const shellAgentActivity = snapshot.shellAgentActivity || {};
  if (shellAgentActivity) {
    lines.push(`shellActivity=${summarizeShellActivity(shellAgentActivity)}`);
  }

  const operationsBoard = snapshot.operationsBoard || {};
  if (operationsBoard && Object.keys(operationsBoard).length) {
    lines.push(`operationsBoard=${summarizeOperationsBoard(operationsBoard)}`);
  }

  const autoSave = snapshot.autoSave || {};
  if (autoSave && typeof autoSave === 'object') {
    lines.push(
      `autoSave=status=${normalizeText(autoSave.status || 'unknown')} / lastSaved=${normalizeText(autoSave.lastSavedAt || autoSave.savedAt || '—')} / checkpoint=${normalizeText(autoSave.lastCheckpointAt || autoSave.nextCheckpointAt || '—')}`
    );
  }

  const apiCost = snapshot.apiCost || {};
  if (apiCost && typeof apiCost === 'object') {
    lines.push(`cost=${summarizeCost(apiCost)}`);
    if (Array.isArray(apiCost.warnings) && apiCost.warnings.length) {
      warnings.push(...apiCost.warnings.map((line) => normalizeText(line)).filter(Boolean));
    }
  }

  const confirmationBridge = snapshot.confirmationBridge || {};
  lines.push(`confirmationBridge=${confirmationBridge.detected ? 'detected' : 'clear'}`);

  const humanGate = Array.isArray(snapshot.humanGate) ? snapshot.humanGate : [];
  lines.push(`humanGate=${humanGate.length}`);

  if (Array.isArray(snapshot.warnings) && snapshot.warnings.length) {
    warnings.push(...snapshot.warnings.map((line) => normalizeText(line)).filter(Boolean));
  }

  const latestCommit = dev && Array.isArray(dev.recentCommits) && dev.recentCommits.length
    ? firstLine(dev.recentCommits[0].raw || '')
    : '';
  if (latestCommit) {
    // Redact .env references in commit messages to prevent false-positive secret detection in logs
    lines.push(`latestCommit=${latestCommit.replace(/\.env\b/gi, '[env]')}`);
  }

  const orchestraEvidence = snapshot.latestWorkOrderDecision?.orchestra_evidence
    || snapshot.latestWorkOrderResult?.orchestra_evidence
    || snapshot.operationsBoard?.orchestra_evidence
    || null;
  if (orchestraEvidence) {
    lines.push(`orchestraEvidence=${summarizeOrchestraEvidence(orchestraEvidence)}`);
  }

  lines.push(`releaseTag=v${currentVersion}`);
  lines.push('excluded=redacted sensitive categories');

  const summary = lines.join('\n').replace(/\.env\b/gi, '[env]');
  return {
    status: summary ? 'ok' : 'unavailable',
    summary,
    lines,
    warnings: [...new Set(warnings)].filter(Boolean),
  };
}

module.exports = {
  buildConsoleContextSummary,
  summarizeOrchestraEvidence,
  summarizeOperationsBoard,
  summarizeShellActivity,
  summarizeWorkOrderHandoff,
  summarizeWorkOrderResult,
};
