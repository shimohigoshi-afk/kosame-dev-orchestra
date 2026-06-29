#!/usr/bin/env bash
set -u
cd ~/kosame-dev-orchestra || exit 1

pkill -f "tools/kosame-dev-os-router.js" 2>/dev/null || true
pkill -f "tools/kosame-dev-os-local-cockpit-server.js" 2>/dev/null || true
pkill -f "tools/kosame-dev-os-auto-approval-judge-runner.js" 2>/dev/null || true
pkill -f "tools/kosame-live-cockpit-server.js" 2>/dev/null || true
pkill -f "/codex .*kosame-dev-os-router.js" 2>/dev/null || true
pkill -f "bin/codex kosame-dev-os-router.js" 2>/dev/null || true
pkill -f "claude .*Complete Console Build" 2>/dev/null || true

nohup env DEV_OS_MODE=server DEV_OS_PORT=8091 node tools/kosame-dev-os-router.js > .kosame-handoff/dev-os-router-v113-3-94.log 2>&1 &
nohup env PORT=18080 node tools/kosame-dev-os-local-cockpit-server.js > .kosame-handoff/local-cockpit-v113-3-94-18080.log 2>&1 &
nohup env PORT=8080 node tools/kosame-live-cockpit-server.js > .kosame-handoff/live-cockpit-v113-3-95-8080.log 2>&1 &
nohup npm run dev-os:runner > .kosame-handoff/dev-os-runner-v113-3-94.log 2>&1 &

sleep 2

echo "===== status ====="
curl -s http://127.0.0.1:18080/api/status | head -80 || true

echo
echo "===== snapshot ====="
curl -s http://127.0.0.1:8080/api/snapshot | python3 -c "import sys,json; d=json.load(sys.stdin); print('version:', d.get('version'), '| mode:', d.get('mode'))" 2>/dev/null || echo "snapshot unavailable"

echo
echo "===== UI guard ====="
curl -s http://127.0.0.1:18080/?v=113395 | grep -nE "KOSAME CHAT|AGENT STREAM LOG|ACTIVE TASK STRIP|通知音|通知|sound-state|sound-summary-mode|chat-sound-badge|Enterで送信|Shift\\+Enter|この方針で進める|kosame-console-submit-bridge|kosame-safe-chat-bridge|api/dev-os-local/client.js|sound-ui-repair" | head -220 || true

echo
echo "===== processes ====="
pgrep -af "kosame-dev-os-router|kosame-dev-os-local-cockpit-server|kosame-live-cockpit-server|kosame-dev-os-auto-approval-judge-runner|codex|claude" || true

echo
echo "===== URLs ====="
echo "Console (full snapshot): http://127.0.0.1:8080/?v=113395"
echo "Dev OS local:            http://127.0.0.1:18080/?v=113395"
