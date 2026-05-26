/**
 * Operator Handoff CLI v1.0.5
 * 
 * Generates a handoff document from the state.
 */

function generateHandoff(stateData, completedWork = [], pendingWork = []) {
  const { currentVersion, lastCommit, riskLevel, nextAction } = stateData.state;

  const lines = [
    `# 📦 Handoff: ${new Date().toISOString()}`,
    '',
    '## 📋 Status Overview',
    `- **Version**: ${currentVersion}`,
    `- **Last Commit**: ${lastCommit}`,
    `- **Risk Level**: ${riskLevel}`,
    '',
    '## ✅ Completed Work',
    ...completedWork.map(w => `- ${w}`),
    (completedWork.length === 0 ? '- None recorded' : ''),
    '',
    '## ⏳ Pending Work',
    ...pendingWork.map(w => `- ${w}`),
    (pendingWork.length === 0 ? '- None recorded' : ''),
    '',
    '## 🚀 Next Action',
    `- **Action**: ${nextAction}`,
    '',
    '## ⚠️ Critical Notes (DO NOT TOUCH)',
    '- .env and Secret Manager configuration',
    '- Production deployment keys'
  ];

  return lines.join('\n');
}

module.exports = { generateHandoff };

// CLI Entry Point
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const samplePath = path.join(__dirname, '../fixtures/operator-state.sample.json');
  const stateData = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
  
  const completed = ['Implemented v1.0.1-v1.0.4 packs'];
  const pending = ['Implement v1.1.0-v1.2.0 packs'];

  const handoff = generateHandoff(stateData, completed, pending);
  console.log(handoff);
}
