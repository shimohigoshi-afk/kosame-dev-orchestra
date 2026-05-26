/**
 * Operator Runbook Pack
 * v0.6.0
 */

class OperatorRunbook {
  constructor() {
    this.activeRunbook = null;
    this.step = 0;
  }

  start(runbookId, title) {
    this.activeRunbook = {
      runbookId,
      title,
      startedAt: new Date().toISOString(),
      stepsCompleted: []
    };
    this.step = 1;
    return this.activeRunbook;
  }

  completeStep(description) {
    if (this.activeRunbook) {
      this.activeRunbook.stepsCompleted.push({
        step: this.step++,
        description,
        timestamp: new Date().toISOString()
      });
    }
  }

  finish() {
    if (this.activeRunbook) {
      this.activeRunbook.finishedAt = new Date().toISOString();
      const report = this.activeRunbook;
      this.activeRunbook = null;
      return report;
    }
  }
}

module.exports = { OperatorRunbook };
