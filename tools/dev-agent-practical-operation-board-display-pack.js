'use strict';

const { renderBoard, buildOperationBoard, DANGEROUS_ACTIONS_DENIED: DAD_V45 } = require('./dev-agent-cli-operation-board-pack');

const TOOL_META = {
  version: '48.0.0',
  title:   'KOSAME Dev Orchestra Practical Operation Board Display Pack',
  slug:    'dev-agent-practical-operation-board-display-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)'
];

// デフォルトpacket — 引数なしでも安全に表示できる実用サンプル
const DEFAULT_DISPLAY_OPTS = {
  product:    'KOSAME Dev Orchestra',
  task:       'Practical visual operation line',
  repo:       '/home/shimohigoshi/kosame-dev-orchestra',
  version:    '48.0.0',
  commit:     'HEAD',
  nextAction: 'Select a task template → generate Claude prompt → run verify → acceptance gate',
  blockers:   []
};

function buildDefaultPacket(overrides) {
  const opts   = Object.assign({}, DEFAULT_DISPLAY_OPTS, overrides || {});
  const packet = buildOperationBoard(opts);
  packet.version = TOOL_META.version;
  return packet;
}

function displayBoard(opts) {
  const packet = buildDefaultPacket(opts);
  console.log(packet.boardText);
  return packet;
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  DEFAULT_DISPLAY_OPTS,
  buildDefaultPacket,
  displayBoard
};

if (require.main === module) {
  displayBoard();
}
