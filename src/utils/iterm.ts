import { runAppleScript } from "./applescript";

/** iTerm2 탭 이동 (offset: -1 = 왼쪽, +1 = 오른쪽) */
export async function itermTabNavigate(offset: number): Promise<void> {
  const direction = offset > 0 ? "after" : "before";
  await runAppleScript(`
    tell application "iTerm2"
      activate
      tell current window
        set tabList to tabs
        set currentTab to current tab
        set tabCount to count of tabList
        repeat with i from 1 to tabCount
          if item i of tabList is currentTab then
            set targetIndex to i + (${offset})
            if targetIndex < 1 then set targetIndex to tabCount
            if targetIndex > tabCount then set targetIndex to 1
            select item targetIndex of tabList
            exit repeat
          end if
        end repeat
      end tell
    end tell
  `);
}

/** iTerm2 패널 분할 */
export async function itermSplit(direction: "vertical" | "horizontal"): Promise<void> {
  await runAppleScript(`
    tell application "iTerm2"
      activate
      tell current session of current tab of current window
        split ${direction === "vertical" ? "vertically" : "horizontally"} with default profile
      end tell
    end tell
  `);
}

/** iTerm2 패널 간 이동 */
export async function itermPaneNavigate(direction: "next" | "prev"): Promise<void> {
  // iTerm2는 AppleScript로 직접 패널 이동이 제한적이므로 키보드 단축키 사용
  // ⌘] = 다음 패널, ⌘[ = 이전 패널
  const key = direction === "next" ? "]" : "[";
  await runAppleScript(`
    tell application "iTerm2" to activate
    tell application "System Events"
      keystroke "${key}" using command down
    end tell
  `);
}

/** iTerm2 현재 세션에 텍스트 전송 */
export async function itermSendText(text: string, pressEnter = true): Promise<void> {
  const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  await runAppleScript(`
    tell application "iTerm2"
      activate
      tell current session of current tab of current window
        write text "${escaped}"${pressEnter ? "" : " newline NO"}
      end tell
    end tell
  `);
}

/** iTerm2 현재 세션에 키 입력 전송 (Ctrl+C 등) */
export async function itermSendKeystroke(key: string, modifiers: string[] = []): Promise<void> {
  const modifierStr = modifiers.length > 0
    ? ` using {${modifiers.map(m => `${m} down`).join(", ")}}`
    : "";
  await runAppleScript(`
    tell application "iTerm2" to activate
    tell application "System Events"
      keystroke "${key}"${modifierStr}
    end tell
  `);
}

/** 새 iTerm2 탭에서 명령 실행 */
export async function itermNewTab(command?: string): Promise<void> {
  const writeCmd = command
    ? `tell current session to write text "${command.replace(/"/g, '\\"')}"`
    : "";
  await runAppleScript(`
    tell application "iTerm2"
      activate
      tell current window
        create tab with default profile
        ${writeCmd}
      end tell
    end tell
  `);
}
