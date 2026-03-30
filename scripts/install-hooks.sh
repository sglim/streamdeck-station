#!/bin/bash
# Claude Code Hook 설정에 Stream Deck 연동 hook 추가
# 사용: ./scripts/install-hooks.sh

SETTINGS="$HOME/.claude/settings.json"
HOOK_CMD='curl -s -X POST http://127.0.0.1:19475/hook/EVENT_TYPE -H "Content-Type: application/json" -d @- < /dev/stdin 2>/dev/null || true'

if [ ! -f "$SETTINGS" ]; then
  echo "오류: $SETTINGS 파일을 찾을 수 없습니다."
  exit 1
fi

# jq로 hook 추가
TEMP=$(mktemp)

jq '
  # PreToolUse에 Stream Deck 알림 추가
  .hooks.PreToolUse += [{
    "matcher": "*",
    "hooks": [{
      "type": "command",
      "command": "#!/bin/bash\ninput=$(cat)\necho \"$input\" | curl -s -X POST http://127.0.0.1:19475/hook/PreToolUse -H \"Content-Type: application/json\" -d @- 2>/dev/null || true\necho \"$input\""
    }]
  }] |

  # PostToolUse에 Stream Deck 알림 추가
  .hooks.PostToolUse += [{
    "matcher": "*",
    "hooks": [{
      "type": "command",
      "command": "#!/bin/bash\ninput=$(cat)\necho \"$input\" | curl -s -X POST http://127.0.0.1:19475/hook/PostToolUse -H \"Content-Type: application/json\" -d @- 2>/dev/null || true\necho \"$input\""
    }]
  }] |

  # Stop에 Stream Deck 알림 추가
  .hooks.Stop += [{
    "matcher": "*",
    "hooks": [{
      "type": "command",
      "command": "#!/bin/bash\ninput=$(cat)\necho \"$input\" | curl -s -X POST http://127.0.0.1:19475/hook/Stop -H \"Content-Type: application/json\" -d @- 2>/dev/null || true\necho \"$input\""
    }]
  }]
' "$SETTINGS" > "$TEMP"

if [ $? -eq 0 ] && [ -s "$TEMP" ]; then
  cp "$SETTINGS" "${SETTINGS}.bak"
  mv "$TEMP" "$SETTINGS"
  echo "✅ Claude Code Hook 설정 완료"
  echo "   백업: ${SETTINGS}.bak"
  echo "   추가된 hook: PreToolUse, PostToolUse, Stop → http://127.0.0.1:19475"
else
  echo "오류: hook 설정 추가 실패"
  rm -f "$TEMP"
  exit 1
fi
