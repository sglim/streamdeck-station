import type { Page, Layout } from '../deck/station.js'
import { COLORS, type ButtonSpec, type IconName } from '../deck/render.js'
import { readSystemStats, readContainers } from '../integrations/system.js'
import { emptyLayout, navButton, resolveTrack, type AppContext } from './context.js'

export interface HomeTargets {
  music: () => Page
  lights: () => Page
  scenes: () => Page
  bots: () => Page
  server: () => Page
}

/** 루트 화면: 페이지 이동 + 즐겨찾기 씬 + 서버 상태 요약 */
export class HomePage implements Page {
  readonly id = 'home'
  readonly refreshMs = 5000

  private summary = { load: 0, mem: 0, up: 0, down: 0 }
  private activated: string | null = null

  constructor(
    private readonly ctx: AppContext,
    private readonly targets: HomeTargets,
  ) {}

  private get favorites() {
    return this.ctx.config.hass.favorites?.slice(0, 5) ?? []
  }

  async render(): Promise<Layout> {
    const layout = emptyLayout()

    layout[0] = await this.musicButton()
    layout[1] = navButton('조명', 'bulb', COLORS.amber)
    layout[2] = navButton('씬', 'scene', COLORS.cyan)
    layout[3] = navButton('봇', 'bot', COLORS.green)
    layout[4] = navButton('서버', 'server', COLORS.blue)

    this.favorites.forEach((fav, i) => {
      const justFired = this.activated === fav.entity
      layout[5 + i] = justFired
        ? { icon: 'check', label: fav.label, fg: COLORS.green, accent: COLORS.green, bg: '#16261a' }
        : { icon: (fav.icon as IconName) ?? 'scene', label: fav.label, accent: COLORS.cyan }
    })

    await this.readSummary()
    layout[10] = { label: '모두 끄기', accent: COLORS.red, fg: COLORS.red, bg: '#241416' }
    layout[11] = {
      value: `${Math.round(this.summary.load * 100)}%`,
      label: '부하',
      gauge: this.summary.load,
      accent: this.summary.load > 0.8 ? COLORS.red : COLORS.green,
    }
    layout[12] = {
      value: `${Math.round(this.summary.mem * 100)}%`,
      label: '메모리',
      gauge: this.summary.mem,
      accent: this.summary.mem > 0.85 ? COLORS.amber : COLORS.blue,
    }
    layout[13] = {
      value: `${this.summary.up}/${this.summary.up + this.summary.down}`,
      label: '컨테이너',
      accent: this.summary.down > 0 ? COLORS.red : COLORS.green,
    }
    layout[14] = await this.weatherButton()

    return layout
  }

  /**
   * 음악 페이지로 가는 버튼. 어딘가에서 재생 중이면 버튼 자리에 곡명을 보여준다.
   * 눌렀을 때 음악 페이지로 가는 동작은 재생 여부와 상관없이 같다.
   */
  private async musicButton(): Promise<ButtonSpec> {
    const players = this.ctx.config.hass.players ?? []
    if (players.length === 0 || !this.ctx.hass.enabled) {
      return navButton('음악', 'radio', COLORS.purple)
    }

    const states = await this.ctx.hass.getStates()
    // 그룹이 목록 앞에 있으므로 먼저 재생 중인 것을 찾으면 그게 대표가 된다
    for (const p of players) {
      const state = states.get(p.entity)
      if (state?.state !== 'playing') continue
      const { title, artist } = resolveTrack(state)
      return title
        ? { label: title, sub: artist, accent: COLORS.purple }
        : { icon: 'radio', label: '재생 중', accent: COLORS.purple, bg: COLORS.bgAlt }
    }
    return navButton('음악', 'radio', COLORS.purple)
  }

  private async readSummary(): Promise<void> {
    const [stats, containers] = await Promise.all([readSystemStats(), readContainers()])
    this.summary = {
      load: stats.loadRatio,
      mem: stats.memRatio,
      up: containers.filter((c) => c.running).length,
      down: containers.filter((c) => !c.running).length,
    }
  }

  async onPress(index: number): Promise<void> {
    const { station } = this.ctx
    switch (index) {
      case 0: return station.push(this.targets.music())
      case 1: return station.push(this.targets.lights())
      case 2: return station.push(this.targets.scenes())
      case 3: return station.push(this.targets.bots())
      case 4: return station.push(this.targets.server())
      case 10: return this.allOff()
    }

    const fav = this.favorites[index - 5]
    if (fav && index >= 5 && index <= 9) {
      if (fav.entity.startsWith('scene.')) await this.ctx.hass.activateScene(fav.entity)
      else await this.ctx.hass.toggle(fav.entity)
      this.flash(fav.entity)
    }
  }

  private async allOff(): Promise<void> {
    const scene = this.ctx.config.hass.allOffScene
    if (!scene) return
    await this.ctx.hass.activateScene(scene)
    this.flash(scene)
  }

  /** 눌린 항목을 잠깐 체크 표시로 바꿔 준다 */
  private flash(entity: string): void {
    this.activated = entity
    setTimeout(() => {
      this.activated = null
      this.ctx.station.requestDraw()
    }, 1500).unref()
  }

  /** 바깥 날씨: 상태별 아이콘 + 기온 */
  private async weatherButton(): Promise<ButtonSpec> {
    const entity = this.ctx.config.hass.weather
    if (!entity || !this.ctx.hass.enabled) {
      return { icon: 'cloud', label: '날씨', dim: true }
    }
    const state = await this.ctx.hass.get(entity)
    if (!state || state.state === 'unavailable') {
      return { icon: 'cloud', label: '날씨', dim: true }
    }
    const temp = state.attributes.temperature
    const w = WEATHER[state.state] ?? { icon: 'cloud' as IconName, label: state.state }
    return {
      icon: w.icon,
      label: typeof temp === 'number' ? `${Math.round(temp)}°` : w.label,
      sub: typeof temp === 'number' ? w.label : undefined,
      accent: COLORS.blue,
    }
  }
}

/** HA weather 상태 → 아이콘·한글 이름 */
const WEATHER: Record<string, { icon: IconName; label: string }> = {
  'sunny': { icon: 'sun', label: '맑음' },
  'clear-night': { icon: 'moon', label: '맑음' },
  'partlycloudy': { icon: 'cloudSun', label: '구름 조금' },
  'cloudy': { icon: 'cloud', label: '흐림' },
  'rainy': { icon: 'rain', label: '비' },
  'pouring': { icon: 'rain', label: '폭우' },
  'lightning': { icon: 'storm', label: '뇌우' },
  'lightning-rainy': { icon: 'storm', label: '뇌우' },
  'snowy': { icon: 'snow', label: '눈' },
  'snowy-rainy': { icon: 'snow', label: '진눈깨비' },
  'hail': { icon: 'snow', label: '우박' },
  'fog': { icon: 'fog', label: '안개' },
  'windy': { icon: 'cloud', label: '바람' },
  'windy-variant': { icon: 'cloud', label: '바람' },
  'exceptional': { icon: 'cloud', label: '특보' },
}
