#!/usr/bin/env bash
# Stream Deck 스테이션 데몬을 LaunchAgent로 등록해 로그인 시 자동 실행한다.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="${STREAMDECK_LABEL:-local.streamdeck-station}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NODE="$(command -v node)"
LOG_DIR="$HOME/Library/Logs"

if [ ! -f "$REPO/dist/main.js" ]; then
  echo "빌드가 없습니다. 먼저 실행하세요: npm run build" >&2
  exit 1
fi

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$REPO/dist/main.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$REPO</string>
  <!-- launchd 는 로그인 셸의 PATH 를 물려받지 않는다. docker/launchctl 을 찾으려면 직접 지정해야 한다. -->
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/streamdeck-station.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/streamdeck-station.err</string>
</dict>
</plist>
PLISTEOF

# 이미 등록돼 있으면 내렸다가 다시 올린다.
# bootout 직후에는 launchd 가 아직 정리 중이라 bootstrap 이 I/O 오류로 실패할 수 있어 잠시 기다린다.
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || break
    sleep 1
  done
fi
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

echo "등록 완료: $LABEL"
echo "  로그:   tail -f $LOG_DIR/streamdeck-station.log"
echo "  재시작: launchctl kickstart -k gui/$(id -u)/$LABEL"
echo "  중지:   launchctl bootout gui/$(id -u)/$LABEL"
