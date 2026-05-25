"use strict";

// Displays the current live call gate status.
// API key values are never shown — only boolean presence is reported.

const { getConfig } = require("../providers/provider-config");

const config = getConfig();

console.log("===== agent-live-gate-check =====");
console.log("liveCallsRequested      :", config.liveCallsRequested);
console.log("openaiKeyPresent        :", config.openaiKeyPresent);
console.log("geminiKeyPresent        :", config.geminiKeyPresent);
console.log("liveCallsActuallyEnabled:", config.liveCallsActuallyEnabled);
console.log("reason                  :", config.reason);
console.log("===== end =====");
