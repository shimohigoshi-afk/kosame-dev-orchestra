/**
 * Agent Performance Review Pack
 * v0.8.3
 */

function generateScorecard(agentId, tasks) {
  const totalTasks = tasks.length;
  if (totalTasks === 0) return null;

  const successCount = tasks.filter(t => t.status === 'success').length;
  const successRate = successCount / totalTasks;

  return {
    version: '1.0.0',
    scorecard: {
      agentId,
      timestamp: new Date().toISOString(),
      metrics: {
        totalTasks,
        successCount,
        successRate
      },
      summary: `Agent ${agentId} achieved a success rate of ${(successRate * 100).toFixed(1)}%.`
    }
  };
}

module.exports = { generateScorecard };
