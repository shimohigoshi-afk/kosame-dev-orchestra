#!/usr/bin/env node
'use strict';

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
  const commit = firstLine(Array.isArray(project.recentCommits) && project.recentCommits.length ? project.recentCommits[0].raw : '');
  const actions = firstLine(Array.isArray(project.githubActions) && project.githubActions.length ? project.githubActions[0] : '');
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

  lines.push(`KOSAME Console / version=${normalizeText(snapshot.version || 'unknown')} / mode=${normalizeText(snapshot.mode || 'Readonly')}`);
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
    lines.push(`latestCommit=${latestCommit}`);
  }

  lines.push(`releaseTag=v${normalizeText(snapshot.version || 'unknown')}`);
  lines.push('excluded=redacted sensitive categories');

  const summary = lines.join('\n');
  return {
    status: summary ? 'ok' : 'unavailable',
    summary,
    lines,
    warnings: [...new Set(warnings)].filter(Boolean),
  };
}

module.exports = {
  buildConsoleContextSummary,
};
