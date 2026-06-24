#!/usr/bin/env bash
# ============================================================
# Kosame Executor Packet Lane Generator
# Executor Packet (.kosame-executor/run-latest.sh) を生成する。
#
# Usage:
#   bash scripts/kosame-run-latest.sh [--run]
#
# --run オプション付きの場合、生成後に即実行する。
# ============================================================
set -eo pipefail

GREEN='\033[0;32m' YELLOW='\033[1;33m' RED='\033[0;31m' NC='\033[0m'
BOLD='\033[1m'

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXECUTOR_DIR="${ROOT}/.kosame-executor"
OUTPUT="${EXECUTOR_DIR}/run-latest.sh"

VERSION=$(node -e "console.log(require('${ROOT}/package.json').version)" 2>/dev/null || echo "unknown")
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
GENERATED_BY="scripts/kosame-run-latest.sh"

mkdir -p "${EXECUTOR_DIR}"

# ------------------------------------------------------------------
# Packet 生成
# ------------------------------------------------------------------
cat > "${OUTPUT}" << PACKET
#!/usr/bin/env bash
# ============================================================
# Kosame Executor Packet (Auto-Generated)
# Version : ${VERSION}
# Generated: ${TIMESTAMP}
# Generator: ${GENERATED_BY}
#
# 実行: bash .kosame-executor/run-latest.sh
# ============================================================
set -eo pipefail

GREEN='\033[0;32m' YELLOW='\033[1;33m' RED='\033[0;31m' NC='\033[0m'
BOLD='\033[1m'

ROOT="${ROOT}"
cd "\${ROOT}"

echo -e "\${BOLD}╔═══════════════════════════════════════════════╗\${NC}"
echo -e "\${BOLD}║  Kosame Executor Packet Lane v${VERSION}   ║\${NC}"
echo -e "\${BOLD}║  Generated: ${TIMESTAMP}            ║\${NC}"
echo -e "\${BOLD}╚═══════════════════════════════════════════════╝\${NC}"
echo ""

# ── [1/8] Dirty Check ──────────────────────────────────────
echo -e "\${BOLD}[1/8] Dirty check...\${NC}"
if git diff --quiet && git diff --cached --quiet; then
  echo -e "  \${GREEN}✓ Working tree clean\${NC}"
else
  echo -e "  \${YELLOW}⚠ Uncommitted changes:\${NC}"
  git status --short
fi

# ── [2/8] Smoke ────────────────────────────────────────────
echo -e "\${BOLD}[2/8] Smoke tests...\${NC}"
npm run smoke:v113-3-45 2>&1 | tail -3
npm run smoke:v113-3-47 2>&1 | tail -3
npm run smoke:v113-3-48 2>&1 | tail -3
npm run smoke:v113-3-49 2>&1 | tail -3
echo -e "  \${GREEN}✓ Smoke PASSED\${NC}"

# ── [3/8] Verify ───────────────────────────────────────────
echo -e "\${BOLD}[3/8] Verify...\${NC}"
if npm run verify > /tmp/kosame-verify.log 2>&1; then
  echo -e "  \${GREEN}✓ Verify PASSED\${NC}"
else
  echo -e "  \${RED}✗ Verify FAILED\${NC}"
  tail -20 /tmp/kosame-verify.log
  exit 1
fi

# ── [4/8] Git add (個別) ────────────────────────────────────
echo -e "\${BOLD}[4/8] Git staging (個別 add)...\${NC}"
CHANGED=\$(git diff --name-only HEAD 2>/dev/null || true)
UNTRACKED=\$(git ls-files --others --exclude-standard 2>/dev/null || true)
ALL_FILES=\$(printf '%s\n%s' "\${CHANGED}" "\${UNTRACKED}" | grep -v '^\$' | sort -u || true)
if [ -z "\${ALL_FILES}" ]; then
  echo -e "  \${YELLOW}⚠ No new changes to stage\${NC}"
else
  while IFS= read -r f; do
    [ -n "\$f" ] && git add "\$f" && echo "  + \$f"
  done <<< "\${ALL_FILES}"
  echo -e "  \${GREEN}✓ Files staged individually\${NC}"
fi

# ── [5/8] Commit ───────────────────────────────────────────
echo -e "\${BOLD}[5/8] Commit...\${NC}"
if git diff --cached --quiet; then
  echo -e "  \${YELLOW}⚠ Nothing to commit\${NC}"
else
  git commit -m "chore: executor packet run v${VERSION} at ${TIMESTAMP}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  echo -e "  \${GREEN}✓ Committed\${NC}"
fi

# ── [6/8] Push ─────────────────────────────────────────────
echo -e "\${BOLD}[6/8] Push...\${NC}"
git push origin main
echo -e "  \${GREEN}✓ Pushed to origin/main\${NC}"

# ── [7/8] Tag ──────────────────────────────────────────────
echo -e "\${BOLD}[7/8] Tag...\${NC}"
TAG="v${VERSION}"
if git rev-parse "\${TAG}" >/dev/null 2>&1; then
  echo -e "  \${YELLOW}⚠ Tag \${TAG} already exists — skip\${NC}"
else
  git tag -a "\${TAG}" -m "Release \${TAG} — ${TIMESTAMP}"
  git push origin "\${TAG}"
  echo -e "  \${GREEN}✓ Tagged and pushed: \${TAG}\${NC}"
fi

# ── [8/8] Final Status ─────────────────────────────────────
echo -e "\${BOLD}[8/8] Final Status...\${NC}"
echo ""
echo -e "  Branch : \$(git branch --show-current)"
echo -e "  HEAD   : \$(git log --oneline -1)"
echo -e "  Tag    : ${VERSION}"
echo ""
echo -e "\${GREEN}\${BOLD}✅ Kosame Executor Packet Lane completed — v${VERSION}\${NC}"
PACKET

chmod +x "${OUTPUT}"

echo -e "${GREEN}✓ Executor Packet generated: ${OUTPUT}${NC}"
echo -e "  Version  : ${VERSION}"
echo -e "  Timestamp: ${TIMESTAMP}"
echo ""
echo -e "  ${BOLD}実行:${NC} bash .kosame-executor/run-latest.sh"

# --run オプション付きなら即実行
if [[ "${1:-}" == "--run" ]]; then
  echo ""
  echo -e "${YELLOW}[--run] Executor Packet を即実行します...${NC}"
  bash "${OUTPUT}"
fi
