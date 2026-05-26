/**
 * Operator Session Record Pack
 * v0.6.1
 */

class OperatorSessionRecord {
  constructor() {
    this.session = null;
  }

  startSession(params) {
    this.session = {
      sessionId: `SES-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 8)}-${Math.floor(Math.random() * 1000)}`,
      startTime: new Date().toISOString(),
      completedTasks: [],
      failedTasks: [],
      ...params
    };
    return this.session;
  }

  addTaskResult(taskId, status, memo = '') {
    if (this.session) {
      const result = { taskId, status, memo, timestamp: new Date().toISOString() };
      if (status === 'completed') {
        this.session.completedTasks.push(result);
      } else {
        this.session.failedTasks.push(result);
      }
    }
  }

  completeSession(nextAction) {
    if (this.session) {
      this.session.endTime = new Date().toISOString();
      this.session.nextAction = nextAction;
      return this.session;
    }
  }
}

module.exports = { OperatorSessionRecord };
