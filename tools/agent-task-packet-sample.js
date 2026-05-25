"use strict";

const samplePacket = {
  id: "task-sample-001",
  type: "review",
  input: "KOSAME Dev Orchestra の permission-policy を確認し、Human Approval が必要な操作を列挙してください。",
  options: {
    language: "ja",
    maxTokens: 512,
  },
};

console.log("===== agent-task-packet-sample =====");
console.log(JSON.stringify(samplePacket, null, 2));
console.log("===== end =====");
