/**
 * Operator Completion Checklist Pack v1.2.3
 *
 * Generates the completion checklist for the Local Operator Console.
 */

const CHECKLIST_ITEMS = [
  { id: 'cli-unified', label: 'Unified CLI entry point wired', required: true },
  { id: 'bundle-export', label: 'Console bundle export working', required: true },
  { id: 'safety-contract', label: 'Safety contract validated', required: true },
  { id: 'smoke-registry', label: 'Smoke registry up-to-date', required: true },
  { id: 'self-review', label: 'Self-review passed', required: true },
  { id: 'handoff-complete', label: 'Handoff document generated', required: true },
  { id: 'claude-escalation-complete', label: 'Claude escalation path verified', required: false },
  { id: 'gemini-work-complete', label: 'Gemini next-work path verified', required: false },
  { id: 'local-console-complete', label: 'Local console complete flow verified', required: true },
  { id: 'release-pack', label: 'Release pack generated', required: true }
];

function generateChecklist(completedIds = []) {
  const items = CHECKLIST_ITEMS.map(item => ({
    ...item,
    completed: completedIds.includes(item.id)
  }));

  const required = items.filter(i => i.required);
  const allRequiredDone = required.every(i => i.completed);

  return {
    version: '1.2.3',
    timestamp: new Date().toISOString(),
    items,
    summary: {
      total: items.length,
      completed: items.filter(i => i.completed).length,
      requiredTotal: required.length,
      requiredCompleted: required.filter(i => i.completed).length,
      allRequiredDone
    },
    status: allRequiredDone ? 'COMPLETE' : 'INCOMPLETE',
    dryRun: true
  };
}

module.exports = { generateChecklist, CHECKLIST_ITEMS };

if (require.main === module) {
  const result = generateChecklist();
  console.log(JSON.stringify(result, null, 2));
}
