#!/usr/bin/env bash
# Kosame Executor Packet Lane — Entry Point
# このファイルは scripts/kosame-run-latest.sh が自動生成します。
# 手動編集不要。再生成: bash scripts/kosame-run-latest.sh
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "${ROOT}/scripts/kosame-run-latest.sh" --run "$@"
