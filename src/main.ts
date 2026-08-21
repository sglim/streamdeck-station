import { loadConfig } from './config.js'
import { Station } from './deck/station.js'
import { COLORS } from './deck/render.js'
import { Hass } from './integrations/hass.js'
import { HomePage } from './pages/home.js'
import { MusicPage } from './pages/music.js'
import { EntityPage } from './pages/entities.js'
import { BotsPage } from './pages/bots.js'
import { ServerPage } from './pages/server.js'
import type { AppContext } from './pages/context.js'
import type { Page } from './deck/station.js'

const config = await loadConfig()
const hass = new Hass(config.hass.url, config.hass.token)
const station = new Station(config.brightness)
const ctx: AppContext = { station, hass, config }

/** 페이지는 상태(선택된 스피커, 확인 대기 등)를 들고 있으므로 한 번만 만든다 */
const memo = new Map<string, Page>()
const once = (key: string, make: () => Page) => (): Page => {
  const hit = memo.get(key)
  if (hit) return hit
  const page = make()
  memo.set(key, page)
  return page
}

const home = new HomePage(ctx, {
  music: once('music', () => new MusicPage(ctx)),
  lights: once('lights', () => new EntityPage(
    'lights',
    ctx,
    [...(config.hass.lights ?? []), ...(config.hass.switches ?? [])],
    'toggle',
    COLORS.amber,
  )),
  scenes: once('scenes', () => new EntityPage(
    'scenes', ctx, config.hass.scenes ?? [], 'scene', COLORS.cyan,
  )),
  bots: once('bots', () => new BotsPage(ctx)),
  server: once('server', () => new ServerPage(ctx)),
})

if (!hass.enabled) {
  console.warn('[main] HA 토큰이 없습니다. 조명/씬/음악 기능이 비활성화됩니다 (config/local.json)')
}

let shuttingDown = false
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`\n[main] ${sig} 수신, 종료합니다`)
    void station.shutdown().finally(() => process.exit(0))
  })
}

process.on('unhandledRejection', (err) => {
  console.error('[main] 처리되지 않은 예외:', err)
})

await station.start(home)
console.log('[main] 준비 완료')
