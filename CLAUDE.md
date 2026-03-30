# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

모든 문서와 답변은 한글로, 존댓말을 사용합니다.
탭 문자 대신 space를 사용합니다 (softtab, 2칸 indent).

## 프로젝트 개요

Claude Code와 iTerm2를 제어하는 Elgato Stream Deck 커스텀 플러그인.
AgentDeck(github.com/puritysb/AgentDeck)에서 영감을 받되, 15키 Stream Deck에 맞춘 경량 구현.

## 기기 스펙

- **모델**: Elgato Stream Deck (20GBL9901), 15키 (5열 × 3행), Keypad 전용
- **좌표계**: `"열,행"` 형식 (0,0 = 좌상단, 4,2 = 우하단)
- **플러그인 경로**: `~/Library/Application Support/com.elgato.StreamDeck/Plugins/`

## 기술 스택

- **SDK**: Elgato Stream Deck SDK v2 (Node.js + TypeScript)
- **런타임**: Node.js 20+ (SDK 요구사항)
- **빌드**: Rollup (SDK 기본 제공)
- **CLI**: `@elgato/cli` (`streamdeck` 명령)
- **macOS 연동**: AppleScript via `osascript` (iTerm2 제어)
- **아이콘 생성**: `rsvg-convert` (SVG → PNG)
- **포맷팅**: Biome (prettier 사용 금지)

## 빌드 및 개발 명령

```bash
npm run build                              # 빌드
npm run watch                              # 핫 리로드 개발
streamdeck restart com.sglim.claude-machine  # 플러그인 재시작
streamdeck pack                            # .streamDeckPlugin 패키징
bash scripts/generate-icons.sh             # 아이콘 PNG 재생성
bash scripts/install-hooks.sh              # Claude Code hook 설정 추가
```

## 아키텍처

```
사용자 → Stream Deck 버튼 → 플러그인 (Node.js)
                                  ├── osascript → iTerm2 (탭/패널 이동, 명령 전송)
                                  ├── HTTP Server (port 19475) ← Claude Code Hooks
                                  └── 상태 관리 → 버튼 동적 업데이트
```

### 플러그인 구조

```
src/
  plugin.ts              # 진입점 - registerAction + hookServer + connect
  actions/
    iterm-navigate.ts     # iTerm2 탭/패널 이동, 분할, 새 탭
    send-to-iterm.ts      # 텍스트 전송, Ctrl+C (상태 반응)
  utils/
    applescript.ts        # osascript 실행 헬퍼
    iterm.ts              # iTerm2 AppleScript 명령 모음
    hook-server.ts        # HTTP 서버 (Claude Code hook 수신, port 19475)
    state.ts              # ClaudeStateManager (EventEmitter 기반)

com.sglim.claude-machine.sdPlugin/
  manifest.json           # 플러그인 메타 + 액션 정의
  bin/                    # Rollup 빌드 출력 (gitignore)
  imgs/actions/           # 아이콘 PNG (@1x 72px, @2x 144px)
  ui/                     # Property Inspector HTML
```

### Claude Code Hook 연동

`~/.claude/settings.json`에 hook 등록 → stdin JSON을 HTTP POST로 전달:
- `PreToolUse` → 상태: processing, STOP 버튼 활성화
- `PostToolUse` → 상태: idle
- `Stop` → 상태: stopped → 3초 후 idle
- Hook 서버 포트: `127.0.0.1:19475`

### 상태 머신

```
disconnected → idle ⇄ processing → stopped → idle (3초 후)
```

## 주요 참조

- Stream Deck SDK: https://docs.elgato.com/streamdeck/sdk/
- AgentDeck: https://github.com/puritysb/AgentDeck
- iTerm2 AppleScript: https://iterm2.com/documentation-scripting.html
