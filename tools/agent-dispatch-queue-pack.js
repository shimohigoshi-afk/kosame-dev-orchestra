/**
 * Agent Dispatch Queue Pack
 * v0.5.2
 */

class AgentDispatchQueue {
  constructor() {
    this.queue = [];
    this.history = [];
  }

  enqueue(command, priority = 'normal') {
    const entry = {
      ...command,
      priority,
      status: 'queued',
      dispatchedAt: null,
      completedAt: null,
      logs: []
    };
    this.queue.push(entry);
    return entry;
  }

  dispatch(commandId, agentId) {
    const command = this.queue.find(c => c.commandId === commandId);
    if (command) {
      command.status = 'running';
      command.assignedTo = agentId;
      command.dispatchedAt = new Date().toISOString();
      command.logs.push(`Dispatched to ${agentId}`);
    }
    return command;
  }

  complete(commandId, result) {
    const index = this.queue.findIndex(c => c.commandId === commandId);
    if (index !== -1) {
      const command = this.queue[index];
      command.status = 'needs_review';
      command.result = result;
      command.completedAt = new Date().toISOString();
      command.logs.push('Execution completed, pending review');
      return command;
    }
  }
}

module.exports = { AgentDispatchQueue };
