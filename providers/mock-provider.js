"use strict";

function run(taskPacket) {
  const preview = String(taskPacket.input || "").slice(0, 80);
  return Promise.resolve({
    success: true,
    provider: "mock",
    response: `[mock] task=${taskPacket.id} type=${taskPacket.type} input="${preview}"`,
    error: null,
    dryRun: false,
  });
}

module.exports = { name: "mock", run };
