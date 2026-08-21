import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
/** dist/ 기준으로 저장소 루트 */
export const ROOT = join(here, '..')

export interface EntityButton {
  label: string
  entity: string
  /** 버튼에 쓸 아이콘 (render.ts의 IconName) */
  icon?: string
}

export interface RadioPreset {
  label: string
  /** 스트리밍 URL 또는 HA media_content_id */
  url: string
  sub?: string
}

export interface BotButton {
  label: string
  job: string
}

export interface Config {
  /** 0~100 */
  brightness: number
  hass: {
    url: string
    /** 장기 액세스 토큰. 비어 있으면 HA 기능이 꺼진다. */
    token: string
    /** 음악 페이지가 제어할 기본 media_player 엔티티 */
    defaultPlayer?: string
    /** 음악 페이지에서 고를 수 있는 스피커들 */
    players?: EntityButton[]
    lights?: EntityButton[]
    scenes?: EntityButton[]
    switches?: EntityButton[]
    radio?: RadioPreset[]
    /** 홈 화면 두 번째 줄에 바로 놓을 씬·스위치 (최대 5개) */
    favorites?: EntityButton[]
    /** 홈의 "모두 끄기" 버튼이 실행할 씬 */
    allOffScene?: string
    /** 홈 날씨 버튼이 볼 weather 엔티티 */
    weather?: string
  }
  bots: BotButton[]
  /** 서버 페이지에 보여줄 컨테이너 이름 */
  containers: string[]
}

const DEFAULTS: Config = {
  brightness: 80,
  hass: { url: 'http://localhost:8123', token: '' },
  bots: [],
  containers: [],
}

/** HA 토큰을 담고 있는 환경변수 이름 */
const TOKEN_ENV = 'HA_TOKEN_STREAMDECK'

/**
 * config/config.json(공유 설정) 위에 config/local.json(비밀)을 덮어쓴다.
 * 토큰은 환경변수 > .envrc > local.json 순으로 찾는다.
 * launchd 로 뜬 데몬에는 direnv 가 적용되지 않으므로 .envrc 를 직접 읽는다.
 */
export async function loadConfig(): Promise<Config> {
  const base = await readJson(join(ROOT, 'config', 'config.json'))
  const local = await readJson(join(ROOT, 'config', 'local.json'))
  const token = process.env[TOKEN_ENV] ?? (await readEnvrc())[TOKEN_ENV] ?? local.hass?.token ?? ''

  return {
    ...DEFAULTS,
    ...base,
    ...local,
    hass: { ...DEFAULTS.hass, ...base.hass, ...local.hass, token },
  } as Config
}

/** 저장소 루트의 .envrc 에서 KEY=VALUE 를 읽는다 (direnv 없이도 동작하도록) */
async function readEnvrc(): Promise<Record<string, string>> {
  const vars: Record<string, string> = {}
  let text: string
  try {
    text = await readFile(join(ROOT, '.envrc'), 'utf8')
  } catch {
    return vars
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    vars[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, '')
  }
  return vars
}

async function readJson(path: string): Promise<Record<string, any>> {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`[config] ${path} 읽기 실패:`, (err as Error).message)
    }
    return {}
  }
}
