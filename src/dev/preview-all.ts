/** 모든 페이지를 PNG로 렌더링해 디자인을 확인하는 개발용 스크립트 */
import { loadConfig } from '../config.js'
import { Station, type Page } from '../deck/station.js'
import { COLORS } from '../deck/render.js'
import { Hass } from '../integrations/hass.js'
import { HomePage } from '../pages/home.js'
import { MusicPage } from '../pages/music.js'
import { EntityPage } from '../pages/entities.js'
import { BotsPage } from '../pages/bots.js'
import { ServerPage } from '../pages/server.js'
import type { AppContext } from '../pages/context.js'
import { savePreview } from './preview.js'

const outDir = process.argv[2] ?? '/tmp'
const config = await loadConfig()
const hass = new Hass(config.hass.url, config.hass.token)
const station = new Station(config.brightness)
const ctx: AppContext = { station, hass, config }

const stub = (): Page => ({ id: 'stub', render: () => [] })
const pages: Record<string, Page> = {
  home: new HomePage(ctx, { music: stub, lights: stub, scenes: stub, bots: stub, server: stub }),
  music: new MusicPage(ctx),
  lights: new EntityPage('lights', ctx,
    [...(config.hass.lights ?? []), ...(config.hass.switches ?? [])], 'toggle', COLORS.amber),
  scenes: new EntityPage('scenes', ctx, config.hass.scenes ?? [], 'scene', COLORS.cyan),
  bots: new BotsPage(ctx),
  server: new ServerPage(ctx),
}

for (const [name, page] of Object.entries(pages)) {
  await page.onEnter?.()
  const path = `${outDir}/page-${name}.png`
  await savePreview(await page.render(), path)
  console.log('saved:', path)
}
process.exit(0)
