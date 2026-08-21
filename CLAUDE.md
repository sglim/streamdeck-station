# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고하는 지침입니다.

모든 문서와 답변은 한글로, 존댓말을 사용합니다.
탭 문자 대신 space를 사용합니다 (softtab, 2칸 indent).

## 프로젝트 개요

화면 없이 서버로 돌리는 M1 MacBook Pro를 **Stream Deck MK.2로 제어하는 상주 데몬**입니다.
집 안 조명·씬(Home Assistant), 음악 재생, 자동화 봇(launchd), 서버 상태를 15개 버튼으로 다룹니다.

Elgato의 Stream Deck 데스크톱 앱은 **쓰지 않습니다**. Node가 USB HID로 장치를 직접 잡습니다.
헤드리스 서버라 GUI 앱을 띄울 이유가 없고, 버튼 배치를 전부 코드와 설정 파일로 관리할 수 있기 때문입니다.

## 기기 스펙

- **모델**: Stream Deck MK.2 (Scissor), 15키 (5열 × 3행), 버튼당 72×72 px
- **인덱스**: 0 = 좌상단, 14 = 우하단. `at(col, row)` 헬퍼로 좌표 변환
- **관례**: 서브 페이지는 14번(우하단)에 항상 홈 복귀 버튼을 둡니다

## 기술 스택

- **런타임**: Node.js 26 (`/opt/homebrew/bin/node`), TypeScript, ESM
- **장치 제어**: `@elgato-stream-deck/node` v7 — `deck.CONTROLS` 배열 기반 API
- **버튼 렌더링**: `sharp`로 SVG → raw RGBA. `fillKeyBuffer`는 PNG가 아닌 **raw 픽셀**만 받습니다
- **빌드**: `tsc` 하나 (번들러 없음)
- **자동 시작**: launchd LaunchAgent (`com.dennis.streamdeck-station`)

## 명령

```bash
npm run build                       # dist/ 로 컴파일
npm run dev                         # tsc --watch
node dist/main.js                   # 직접 실행 (디버깅용)
bash scripts/install-daemon.sh      # LaunchAgent 등록 + 시작
node dist/dev/preview-all.js /tmp   # 모든 페이지를 PNG로 렌더 (하드웨어 없이 디자인 확인)

launchctl kickstart -k gui/501/com.dennis.streamdeck-station   # 재시작
tail -f ~/Library/Logs/streamdeck-station.log                  # 로그
```

데몬이 장치를 독점하므로, **직접 실행 전에 LaunchAgent를 먼저 내려야 합니다.**

## 구조

```
src/
  main.ts                 진입점 — 설정 로드, 페이지 조립, 시그널 처리
  config.ts               config/config.json + config/local.json 병합
  deck/
    render.ts             ButtonSpec → 72x72 raw RGBA. 아이콘 SVG path, 폭 기반 자동 줄바꿈/축소
    station.ts            장치 연결·재연결, 페이지 스택, 렌더 diff, 입력 라우팅
  integrations/
    exec.ts               외부 명령 실행 (항상 타임아웃)
    system.ts             부하·메모리·디스크·업타임·docker 컨테이너
    launchd.ts            launchctl 잡 상태 조회 및 수동 실행
    hass.ts               Home Assistant REST 클라이언트 (상태 캐시 포함)
  pages/
    context.ts            페이지 공용 헬퍼 (빈 레이아웃, 홈 버튼 등)
    home.ts               루트 — 페이지 이동 + 즐겨찾기 씬 + 상태 요약 + 밝기
    music.ts              재생 제어, 볼륨, 라디오 프리셋, 스피커 선택
    entities.ts           조명/스위치 토글, 씬 실행 (mode로 구분)
    bots.ts               launchd 잡 상태 표시 및 수동 실행
    server.ts             시스템 지표 + 컨테이너 상태/재시작
  dev/
    preview.ts            레이아웃 → 5x3 합성 PNG
    preview-all.ts        전체 페이지 미리보기 생성

config/
  config.json             버튼 구성 (엔티티 ID, 봇 목록, 컨테이너) — git 추적
  local.json              HA 토큰 등 비밀 — gitignore
```

## 설계 관례

- **되돌릴 수 없는 동작은 두 번 눌러야 실행됩니다.** 컨테이너 재시작, 봇 수동 실행이 해당합니다.
  첫 번째 누름은 확인 요청만 표시하고 4초 뒤 자동 취소됩니다.
- **HA 토큰이 없으면 해당 기능만 꺼지고 데몬은 계속 돕니다.** 음악·조명 페이지가 안내를 표시합니다.
- **버튼은 변경된 칸만 다시 그립니다** (`Station.lastDrawn`). HID 대역폭이 넉넉하지 않습니다.
- **launchd 환경에는 로그인 셸의 PATH가 없습니다.** plist에 PATH를 명시하지 않으면 `docker`를
  찾지 못합니다. 새 외부 명령을 쓸 때 이 점을 확인하세요.
- 라벨은 폭 기준으로 자동 축소·줄바꿈됩니다. 글자 수로 자르지 마세요 (한글은 영문의 약 2배 폭).

## 연동 대상 (이 맥의 실제 구성)

- **Home Assistant**: Docker 컨테이너, `localhost:8123`, 설정은 `~/repos/iot/stack/homeassistant`
  - SmartThings 통합으로 조명 6 / 스위치 17 / 씬 13 / 커튼 1
  - 음악은 Google Cast 통합의 `media_player` 엔티티를 씁니다 (Google Home Mini)
- **자동화 봇**: `ai.everystat.*`, `com.dennis.venture-*` LaunchAgent 40여 개
- **컨테이너**: homeassistant, postgres, mosquitto (colima 위 docker)

## 주요 참조

- node-elgato-stream-deck: https://github.com/Julusian/node-elgato-stream-deck
- Home Assistant REST API: https://developers.home-assistant.io/docs/api/rest/
