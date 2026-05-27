'use strict';

const TOOL_META = {
  version: '6.4.0',
  title: 'Issue/Ticket Runner Pack',
  slug: 'issue-ticket-runner-pack'
};

const TICKET_STATUSES = ['open', 'in_progress', 'awaiting_approval', 'verified', 'closed', 'blocked'];

const TICKET_TYPES = ['implementation', 'bulk_draft', 'verify', 'review', 'deploy', 'release', 'design'];

const APPROVAL_REQUIRED_TYPES = ['deploy', 'release'];

function createTicket(input = {}) {
  const type = TICKET_TYPES.includes(input.type) ? input.type : 'implementation';
  return {
    id: input.id || `ticket-${Date.now()}`,
    title: input.title || '(untitled)',
    type,
    assignedProvider: input.assignedProvider || 'claude',
    status: 'open',
    humanApprovalRequired: APPROVAL_REQUIRED_TYPES.includes(type) || input.humanApprovalRequired === true,
    completionConditions: Array.isArray(input.completionConditions) ? input.completionConditions : [],
    verificationConditions: Array.isArray(input.verificationConditions) ? input.verificationConditions : ['node --check', 'npm run verify'],
    approvalGate: APPROVAL_REQUIRED_TYPES.includes(type)
      ? { required: true, approver: 'じゅんやさん' }
      : { required: false, approver: null },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function updateTicket(ticket = {}, changes = {}) {
  const allowedFields = ['status', 'assignedProvider', 'humanApprovalRequired', 'completionConditions'];
  const updated = Object.assign({}, ticket);
  for (const field of allowedFields) {
    if (field in changes) updated[field] = changes[field];
  }
  updated.updatedAt = new Date().toISOString();
  if (!TICKET_STATUSES.includes(updated.status)) {
    updated.status = 'open';
  }
  return updated;
}

function getTicketStatus(ticket = {}) {
  return {
    id: ticket.id,
    title: ticket.title,
    status: ticket.status,
    assignedProvider: ticket.assignedProvider,
    humanApprovalRequired: ticket.humanApprovalRequired,
    approvalGate: ticket.approvalGate,
    isComplete: ticket.status === 'closed',
    isBlocked: ticket.status === 'blocked',
    isAwaitingApproval: ticket.status === 'awaiting_approval'
  };
}

function buildRunnerPlan(tickets = []) {
  const byStatus = {};
open:
  for (const status of TICKET_STATUSES) {
    byStatus[status] = tickets.filter(t => t.status === status);
  }
  const nextTicket = tickets.find(t => t.status === 'open') || null;
  return {
    total: tickets.length,
    byStatus,
    nextTicket,
    humanApprovalRequired: true
  };
}

function buildPacket(input = {}) {
  const rawTickets = Array.isArray(input.tickets) ? input.tickets : [];
  const tickets = rawTickets.map(t => createTicket(t));
  const runnerPlan = buildRunnerPlan(tickets);
  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    ticketStatuses: TICKET_STATUSES,
    ticketTypes: TICKET_TYPES,
    approvalRequiredTypes: APPROVAL_REQUIRED_TYPES,
    tickets,
    runnerPlan
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    tickets: [
      { title: 'implement feature X', type: 'implementation', assignedProvider: 'claude',
        completionConditions: ['code written', 'smoke passing'],
        verificationConditions: ['node --check', 'npm run verify'] },
      { title: 'draft release note', type: 'bulk_draft', assignedProvider: 'gemini',
        completionConditions: ['draft written'] },
      { title: 'deploy to production', type: 'deploy', assignedProvider: 'cloudShell',
        completionConditions: ['deploy successful'] }
    ]
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  TICKET_STATUSES,
  TICKET_TYPES,
  APPROVAL_REQUIRED_TYPES,
  createTicket,
  updateTicket,
  getTicketStatus,
  buildRunnerPlan,
  buildPacket
};
