#!/usr/bin/env bash
# KOSAME API Key Wizard
# Called from KOSAME.bat at startup.
# Prompts only for keys that have no value in .env. Appends with >> only.

ENV_FILE="$HOME/kosame-dev-orchestra/.env"

TARGET_KEYS=(GEMINI_API_KEY DEEPSEEK_API_KEY GROK_API_KEY GROQ_API_KEY OPENAI_API_KEY)
TARGET_LABELS=("Gemini" "DeepSeek" "Grok (xAI)" "Groq" "OpenAI")

# Not interactive (e.g. called from CI) — skip
[ -t 0 ] || exit 0

key_has_value() {
  local key="$1"
  [ -f "$ENV_FILE" ] && grep -qE "^${key}=.+" "$ENV_FILE" 2>/dev/null
}

missing_count=0
for key in "${TARGET_KEYS[@]}"; do
  key_has_value "$key" || missing_count=$((missing_count + 1))
done

[ "$missing_count" -eq 0 ] && exit 0

echo ""
echo "  -----------------------------------------------"
echo "   KOSAME API Key Wizard"
echo "   未設定のAPIキー: ${missing_count} 件"
echo "  -----------------------------------------------"
echo ""

i=0
for key in "${TARGET_KEYS[@]}"; do
  label="${TARGET_LABELS[$i]}"
  i=$((i + 1))

  if key_has_value "$key"; then
    echo "  [SKIP] ${label}: 設定済み"
    continue
  fi

  printf "  %s APIキーを貼り付けてください：" "$label"
  read -rs value
  echo ""

  if [ -n "$value" ]; then
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
    echo "  [SET]  ${label} キーを保存しました"
  else
    echo "  [SKIP] ${label}: スキップしました（空入力）"
  fi
  echo ""
done

echo "  設定完了。サーバーを起動します..."
echo ""
