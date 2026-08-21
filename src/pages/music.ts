import type { Page, Layout } from '../deck/station.js'
import { COLORS, type ButtonSpec } from '../deck/render.js'
import type { HassState } from '../integrations/hass.js'
import { emptyLayout, homeButton, resolveTrack, type AppContext } from './context.js'

const VOLUME_STEP = 0.05
const RADIO_SLOTS = 5

/** 음악 스테이션: HA media_player(구글 홈 미니 등)를 제어한다 */
export class MusicPage implements Page {
  readonly id = 'music'
  readonly refreshMs = 2000

  private playerIndex = 0

  constructor(private readonly ctx: AppContext) {}

  /** 설정된 스피커 목록. 비어 있으면 defaultPlayer 하나만 쓴다. */
  private get players(): { label: string; entity: string }[] {
    const { players, defaultPlayer } = this.ctx.config.hass
    if (players && players.length > 0) return players
    if (defaultPlayer) return [{ label: '스피커', entity: defaultPlayer }]
    return []
  }

  private get player(): { label: string; entity: string } | undefined {
    return this.players[this.playerIndex % Math.max(1, this.players.length)]
  }

  async render(): Promise<Layout> {
    const layout = emptyLayout()
    layout[14] = homeButton()

    const player = this.player
    if (!this.ctx.hass.enabled) {
      layout[7] = { label: 'HA 토큰 없음', sub: 'config/local.json', fg: COLORS.red }
      return layout
    }
    if (!player) {
      layout[7] = { label: '스피커 미설정', sub: 'config.json', fg: COLORS.amber }
      return layout
    }

    const state = await this.ctx.hass.get(player.entity)
    const playing = state?.state === 'playing'
    const available = state !== undefined && state.state !== 'unavailable'
    const volume = typeof state?.attributes.volume_level === 'number'
      ? (state.attributes.volume_level as number)
      : 0

    layout[0] = { icon: 'prev', label: '이전', dim: !available }
    layout[1] = playing
      ? { icon: 'pause', label: '일시정지', fg: COLORS.green, accent: COLORS.green }
      : { icon: 'play', label: '재생', fg: available ? COLORS.fg : COLORS.muted, dim: !available }
    layout[2] = { icon: 'next', label: '다음', dim: !available }
    layout[3] = { icon: 'volDown', label: '볼륨 -', dim: !available }
    layout[4] = { icon: 'volUp', label: '볼륨 +', dim: !available }

    this.ctx.config.hass.radio?.slice(0, RADIO_SLOTS).forEach((preset, i) => {
      layout[5 + i] = {
        icon: 'radio',
        label: preset.label,
        sub: preset.sub,
        accent: COLORS.purple,
      }
    })

    layout[10] = {
      icon: 'speaker',
      label: player.label,
      sub: this.players.length > 1 ? `${this.playerIndex + 1}/${this.players.length}` : undefined,
      accent: COLORS.cyan,
    }
    layout[11] = { icon: 'stop', label: '정지', dim: !available }
    layout[12] = nowPlaying(state)
    layout[13] = {
      value: `${Math.round(volume * 100)}%`,
      label: '볼륨',
      gauge: volume,
      accent: COLORS.purple,
    }

    return layout
  }

  async onPress(index: number): Promise<void> {
    if (index === 14) return this.ctx.station.goHome()

    const player = this.player
    if (!player) return
    const entity = player.entity
    const hass = this.ctx.hass

    switch (index) {
      case 0: return hass.mediaCommand(entity, 'media_previous_track')
      case 1: return hass.mediaCommand(entity, 'media_play_pause')
      case 2: return hass.mediaCommand(entity, 'media_next_track')
      case 3: return this.nudgeVolume(entity, -VOLUME_STEP)
      case 4: return this.nudgeVolume(entity, +VOLUME_STEP)
      case 10:
        // 스피커 순환 선택
        this.playerIndex = (this.playerIndex + 1) % this.players.length
        return
      case 11: return hass.mediaCommand(entity, 'media_stop')
    }

    const preset = this.ctx.config.hass.radio?.[index - 5]
    if (preset && index >= 5 && index <= 9) {
      await hass.playUrl(entity, preset.url)
    }
  }

  private async nudgeVolume(entity: string, delta: number): Promise<void> {
    const state = await this.ctx.hass.get(entity, 500)
    const current = typeof state?.attributes.volume_level === 'number'
      ? (state.attributes.volume_level as number)
      : 0.2
    await this.ctx.hass.setVolume(entity, current + delta)
  }
}

/** 현재 재생 중인 곡을 한 칸에 담는다 */
function nowPlaying(state: HassState | undefined): ButtonSpec {
  if (!state || state.state === 'unavailable' || state.state === 'off') {
    return { icon: 'speaker', label: '꺼짐', dim: true }
  }
  const { title, artist } = resolveTrack(state)
  if (!title) {
    return { icon: 'speaker', label: state.state === 'playing' ? '재생 중' : '대기', dim: true }
  }
  return { label: title, sub: artist, accent: COLORS.purple }
}
