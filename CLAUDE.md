# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

모든 문서와 답변은 한글로, 존댓말을 사용합니다.
탭 문자 대신 space를 사용합니다 (softtab, 2칸 indent).

## 프로젝트 개요

Claude Code와 iTerm2를 제어하는 Elgato Stream Deck 커스텀 플러그인.
AgentDeck(github.com/puritysb/AgentDeck)에서 영감을 받되, 15키 Stream Deck에 맞춘 경량 구현.

## 기기 스펙

- **모델**: Elgato Stream Deck (20GBL9901), 15키 (5행 × 3열), Keypad 전용
- **USB**: Vendor 0x0FD9, Product 0x00A5
- **프로필 경로**: `~/Library/Application Support/com.elgato.StreamDeck/ProfilesV3/`
- **플러그인 경로**: `~/Library/Application Support/com.elgato.StreamDeck/Plugins/`

## 기술 스택

- **SDK**: Elgato Stream Deck SDK v2 (Node.js + TypeScript)
- **런타임**: Node.js 20+ (SDK 요구사항)
- **빌드**: Rollup (SDK 기본 제공)
- **CLI**: `@elgato/cli` (`streamdeck` 명령)
- **macOS 연동**: AppleScript via `osascript` (iTerm2 제어)
- **포맷팅**: Biome (prettier 사용 금지)

## 빌드 및 개발 명령

```bash
# Stream Deck CLI 설치 (최초 1회)
npm install -g @elgato/cli

# 의존성 설치
npm install

# 개발 (핫 리로드, 플러그인 자동 심링크)
npm run watch

# 빌드
npm run build

# 플러그인 패키징 (.streamDeckPlugin 파일 생성)
streamdeck pack

# 개발자 모드 (Property Inspector 디버깅)
streamdeck dev
# → http://localhost:23654/ 에서 디버깅

# 포맷팅/린팅
npx biome check --write <파일>
```

## 아키텍처

```
사용자 → Stream Deck 버튼 → 플러그인 (Node.js)
                                  ├── osascript → iTerm2 (탭/패널 이동, 명령 전송)
                                  ├── child_process → 셸 명령 실행
                                  └── Claude Code Hooks ← HTTP POST (상태 수신)
```

### 플러그인 구조

```
src/
  plugin.ts              # 진입점 - streamDeck.connect()
  actions/               # 각 버튼 액션 (SingletonAction 상속)
    iterm-navigate.ts     # iTerm2 탭/패널 이동
    claude-command.ts     # Claude Code 명령 전송
    app-launcher.ts       # 앱 실행
    media-control.ts      # 미디어 제어
  utils/
    applescript.ts        # osascript 실행 헬퍼
    iterm.ts              # iTerm2 AppleScript 명령 모음

com.sglim.streamdeck.sdPlugin/
  manifest.json           # 플러그인 메타데이터 + 액션 정의
  bin/                    # Rollup 빌드 출력
  imgs/                   # 아이콘 이미지 (72x72 @1x, 144x144 @2x)
  ui/                     # Property Inspector HTML (sdpi-components.js)
```

### 액션 패턴

```typescript
import { action, SingletonAction, KeyDownEvent } from "@elgato/streamdeck";

@action({ UUID: "com.sglim.streamdeck.action-name" })
export class MyAction extends SingletonAction {
  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    // 버튼 눌림 처리
    await ev.action.showOk();  // 성공 피드백
  }
}
```

### iTerm2 제어 방식

AppleScript를 `osascript`로 실행하여 iTerm2 제어:
- 탭 이동: `tell application "iTerm2" to tell current window to select tab N`
- 패널 이동: `tell session to select split pane`
- 명령 전송: `tell current session to write text "command"`

### Claude Code Hook 연동 (향후)

AgentDeck 패턴 참조 — Claude Code의 Hook 시스템으로 상태 수신:
- `~/.claude/settings.json`에 Hook 설정 → HTTP POST → 플러그인 수신
- 상태: IDLE / PROCESSING / AWAITING_PERMISSION
- 버튼 동적 변경 (YES/NO/STOP 등)

## 레이아웃 설계 (15키, 5행 × 3열)

```
행0: [iTerm 탭←] [iTerm 탭→] [iTerm 분할]
행1: [Claude ↵ ] [Claude /commit] [Claude Stop]
행2: [앱1      ] [앱2          ] [앱3       ]
행3: [스크린샷 ] [스크린녹화   ] [🔇 Mute   ]
행4: [Vol-     ] [Vol+         ] [▶ 페이지2 ]
```

## 주요 참조

- Stream Deck SDK 문서: https://docs.elgato.com/streamdeck/sdk/
- AgentDeck (참고): https://github.com/puritysb/AgentDeck
- iTerm2 AppleScript: https://iterm2.com/documentation-scripting.html
