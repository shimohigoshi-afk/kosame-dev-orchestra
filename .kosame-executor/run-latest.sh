#!/usr/bin/env bash
# ============================================================
# Kosame Executor Packet (Auto-Generated)
# Version : 113.3.52
# Generated: 20260625-021010
# Generator: scripts/kosame-run-latest.sh
#
# 実行: bash .kosame-executor/run-latest.sh
# ============================================================
set -eo pipefail

GREEN='\033[0;32m' YELLOW='\033[1;33m' RED='\033[0;31m' NC='\033[0m'
BOLD='\033[1m'

ROOT="/home/lavie/kosame-dev-orchestra"
cd "${ROOT}"

echo -e "${BOLD}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  Kosame Executor Packet Lane v113.3.52   ║${NC}"
echo -e "${BOLD}║  Generated: 20260625-021010            ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# ── [1/8] Dirty Check ──────────────────────────────────────
echo -e "${BOLD}[1/8] Dirty check...${NC}"
if git diff --quiet && git diff --cached --quiet; then
  echo -e "  ${GREEN}✓ Working tree clean${NC}"
else
  echo -e "  ${YELLOW}⚠ Uncommitted changes:${NC}"
  git status --short
fi

# ── [2/8] Smoke ────────────────────────────────────────────
echo -e "${BOLD}[2/8] Smoke tests...${NC}"
npm run smoke:v113-3-45 2>&1 | tail -3
npm run smoke:v113-3-47 2>&1 | tail -3
npm run smoke:v113-3-48 2>&1 | tail -3
npm run smoke:v113-3-49 2>&1 | tail -3
echo -e "  ${GREEN}✓ Smoke PASSED${NC}"

# ── [3/8] Verify ───────────────────────────────────────────
echo -e "${BOLD}[3/8] Verify...${NC}"
if npm run verify > /tmp/kosame-verify.log 2>&1; then
  echo -e "  ${GREEN}✓ Verify PASSED${NC}"
else
  echo -e "  ${RED}✗ Verify FAILED${NC}"
  tail -20 /tmp/kosame-verify.log
  exit 1
fi

# ── [4/8] Git add (個別) ────────────────────────────────────
echo -e "${BOLD}[4/8] Git staging (個別 add)...${NC}"
CHANGED=$(git diff --name-only HEAD 2>/dev/null || true)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null || true)
ALL_FILES=$(printf '%s\n%s' "${CHANGED}" "${UNTRACKED}" | grep -v '^$' | sort -u || true)
if [ -z "${ALL_FILES}" ]; then
  echo -e "  ${YELLOW}⚠ No new changes to stage${NC}"
else
  while IFS= read -r f; do
    [ -n "$f" ] && git add "$f" && echo "  + $f"
  done <<< "${ALL_FILES}"
  echo -e "  ${GREEN}✓ Files staged individually${NC}"
fi

# ── [5/8] Commit ───────────────────────────────────────────
echo -e "${BOLD}[5/8] Commit...${NC}"
if git diff --cached --quiet; then
  echo -e "  ${YELLOW}⚠ Nothing to commit${NC}"
else
  git commit -m "chore: executor packet run v113.3.52 at 20260625-021010

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  echo -e "  ${GREEN}✓ Committed${NC}"
fi

# ── [6/8] Push ─────────────────────────────────────────────
echo -e "${BOLD}[6/8] Push...${NC}"
git push origin main
echo -e "  ${GREEN}✓ Pushed to origin/main${NC}"

# ── [7/8] Tag ──────────────────────────────────────────────
echo -e "${BOLD}[7/8] Tag...${NC}"
TAG="v113.3.52"
if git rev-parse "${TAG}" >/dev/null 2>&1; then
  echo -e "  ${YELLOW}⚠ Tag ${TAG} already exists — skip${NC}"
else
  git tag -a "${TAG}" -m "Release ${TAG} — 20260625-021010"
  git push origin "${TAG}"
  echo -e "  ${GREEN}✓ Tagged and pushed: ${TAG}${NC}"
fi

# ── [8/8] Final Status ─────────────────────────────────────
echo -e "${BOLD}[8/8] Final Status...${NC}"
echo ""
echo -e "  Branch : $(git branch --show-current)"
echo -e "  HEAD   : $(git log --oneline -1)"
echo -e "  Tag    : 113.3.52"
echo ""
echo -e "${GREEN}${BOLD}✅ Kosame Executor Packet Lane completed — v113.3.52${NC}"
