#!/bin/bash
# Stream Deck 아이콘 생성 스크립트
# 사용: ./scripts/generate-icons.sh

PLUGIN_DIR="com.sglim.claude-machine.sdPlugin/imgs"
mkdir -p "$PLUGIN_DIR/actions/iterm/"{icon,key}
mkdir -p "$PLUGIN_DIR/actions/send/"{icon,key}
TMP_DIR=$(mktemp -d)

generate_icon() {
  local name="$1" svg="$2" dir="$3" size="$4"
  echo "$svg" > "$TMP_DIR/${name}.svg"
  rsvg-convert -w "$size" -h "$size" "$TMP_DIR/${name}.svg" > "$dir/${name}.png"
}

# --- iTerm Navigate 아이콘 ---

# Action icon (20x20 / 40x40) - 터미널 아이콘
ITERM_ACTION='<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <rect width="40" height="40" rx="6" fill="#1a1a2e"/>
  <text x="20" y="28" text-anchor="middle" font-size="24" font-family="monospace" fill="#4fc3f7">&gt;_</text>
</svg>'
generate_icon "icon" "$ITERM_ACTION" "$PLUGIN_DIR/actions/iterm" 20
generate_icon "icon@2x" "$ITERM_ACTION" "$PLUGIN_DIR/actions/iterm" 40

# Key icons for each mode
MODES=("tab-prev" "tab-next" "split-v" "split-h" "pane-prev" "pane-next" "new-tab")
SYMBOLS=("◀" "▶" "▐▌" "▬▬" "◁" "▷" "+")
COLORS=("#4fc3f7" "#4fc3f7" "#4fc3f7" "#4fc3f7" "#90caf9" "#90caf9" "#90caf9")

for i in "${!MODES[@]}"; do
  SVG="<svg viewBox=\"0 0 144 144\" xmlns=\"http://www.w3.org/2000/svg\">
    <rect width=\"144\" height=\"144\" rx=\"20\" fill=\"#1a1a2e\"/>
    <text x=\"72\" y=\"85\" text-anchor=\"middle\" font-size=\"56\" font-family=\"sans-serif\" fill=\"${COLORS[$i]}\">${SYMBOLS[$i]}</text>
  </svg>"
  generate_icon "${MODES[$i]}" "$SVG" "$PLUGIN_DIR/actions/iterm/key" 72
  generate_icon "${MODES[$i]}@2x" "$SVG" "$PLUGIN_DIR/actions/iterm/key" 144
done

# Default key icon
generate_icon "key" '<svg viewBox="0 0 144 144" xmlns="http://www.w3.org/2000/svg">
  <rect width="144" height="144" rx="20" fill="#1a1a2e"/>
  <text x="72" y="85" text-anchor="middle" font-size="48" font-family="monospace" fill="#4fc3f7">&gt;_</text>
</svg>' "$PLUGIN_DIR/actions/iterm" 72
generate_icon "key@2x" '<svg viewBox="0 0 144 144" xmlns="http://www.w3.org/2000/svg">
  <rect width="144" height="144" rx="20" fill="#1a1a2e"/>
  <text x="72" y="85" text-anchor="middle" font-size="48" font-family="monospace" fill="#4fc3f7">&gt;_</text>
</svg>' "$PLUGIN_DIR/actions/iterm" 144

# --- Send to iTerm 아이콘 ---

# Action icon
SEND_ACTION='<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <rect width="40" height="40" rx="6" fill="#1a1a2e"/>
  <polygon points="8,6 34,20 8,34" fill="#66bb6a"/>
</svg>'
generate_icon "icon" "$SEND_ACTION" "$PLUGIN_DIR/actions/send" 20
generate_icon "icon@2x" "$SEND_ACTION" "$PLUGIN_DIR/actions/send" 40

# Send key icons
generate_icon "key" '<svg viewBox="0 0 144 144" xmlns="http://www.w3.org/2000/svg">
  <rect width="144" height="144" rx="20" fill="#1a1a2e"/>
  <polygon points="30,30 114,72 30,114" fill="#66bb6a"/>
</svg>' "$PLUGIN_DIR/actions/send" 72
generate_icon "key@2x" '<svg viewBox="0 0 144 144" xmlns="http://www.w3.org/2000/svg">
  <rect width="144" height="144" rx="20" fill="#1a1a2e"/>
  <polygon points="30,30 114,72 30,114" fill="#66bb6a"/>
</svg>' "$PLUGIN_DIR/actions/send" 144

# Yes 버튼
generate_icon "yes" '<svg viewBox="0 0 144 144" xmlns="http://www.w3.org/2000/svg">
  <rect width="144" height="144" rx="20" fill="#1b5e20"/>
  <polyline points="35,75 60,100 110,45" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
</svg>' "$PLUGIN_DIR/actions/send/key" 72
generate_icon "yes@2x" '<svg viewBox="0 0 144 144" xmlns="http://www.w3.org/2000/svg">
  <rect width="144" height="144" rx="20" fill="#1b5e20"/>
  <polyline points="35,75 60,100 110,45" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
</svg>' "$PLUGIN_DIR/actions/send/key" 144

# Stop 버튼
generate_icon "stop" '<svg viewBox="0 0 144 144" xmlns="http://www.w3.org/2000/svg">
  <rect width="144" height="144" rx="20" fill="#b71c1c"/>
  <rect x="40" y="40" width="64" height="64" rx="8" fill="#fff"/>
</svg>' "$PLUGIN_DIR/actions/send/key" 72
generate_icon "stop@2x" '<svg viewBox="0 0 144 144" xmlns="http://www.w3.org/2000/svg">
  <rect width="144" height="144" rx="20" fill="#b71c1c"/>
  <rect x="40" y="40" width="64" height="64" rx="8" fill="#fff"/>
</svg>' "$PLUGIN_DIR/actions/send/key" 144

# Commit 버튼
generate_icon "commit" '<svg viewBox="0 0 144 144" xmlns="http://www.w3.org/2000/svg">
  <rect width="144" height="144" rx="20" fill="#e65100"/>
  <circle cx="72" cy="72" r="24" fill="none" stroke="#fff" stroke-width="10"/>
  <line x1="72" y1="20" x2="72" y2="48" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
  <line x1="72" y1="96" x2="72" y2="124" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
</svg>' "$PLUGIN_DIR/actions/send/key" 72
generate_icon "commit@2x" '<svg viewBox="0 0 144 144" xmlns="http://www.w3.org/2000/svg">
  <rect width="144" height="144" rx="20" fill="#e65100"/>
  <circle cx="72" cy="72" r="24" fill="none" stroke="#fff" stroke-width="10"/>
  <line x1="72" y1="20" x2="72" y2="48" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
  <line x1="72" y1="96" x2="72" y2="124" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
</svg>' "$PLUGIN_DIR/actions/send/key" 144

# Text 버튼 (기본)
generate_icon "text" '<svg viewBox="0 0 144 144" xmlns="http://www.w3.org/2000/svg">
  <rect width="144" height="144" rx="20" fill="#1a1a2e"/>
  <text x="72" y="90" text-anchor="middle" font-size="64" font-family="monospace" fill="#66bb6a">&gt;</text>
</svg>' "$PLUGIN_DIR/actions/send/key" 72
generate_icon "text@2x" '<svg viewBox="0 0 144 144" xmlns="http://www.w3.org/2000/svg">
  <rect width="144" height="144" rx="20" fill="#1a1a2e"/>
  <text x="72" y="90" text-anchor="middle" font-size="64" font-family="monospace" fill="#66bb6a">&gt;</text>
</svg>' "$PLUGIN_DIR/actions/send/key" 144

rm -rf "$TMP_DIR"
echo "아이콘 생성 완료:"
find "$PLUGIN_DIR/actions" -name "*.png" | wc -l
echo "개 PNG 파일"
