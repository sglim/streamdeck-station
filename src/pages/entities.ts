import type { Page, Layout } from '../deck/station.js'
import { COLORS, type IconName } from '../deck/render.js'
import type { EntityButton } from '../config.js'
import { emptyLayout, homeButton, type AppContext } from './context.js'

const MAX_ITEMS = 14
const SCENE_FLASH_MS = 1500

/**
 * HA 엔티티를 나열하는 페이지.
 * - toggle 모드: 조명/스위치를 켜고 끄며 현재 상태를 색으로 보여준다
 * - scene 모드: 누르면 씬을 활성화한다 (씬은 켜짐/꺼짐 상태가 없다)
 */
export class EntityPage implements Page {
  readonly refreshMs: number
  private activated = new Map<string, number>()

  constructor(
    readonly id: string,
    private readonly ctx: AppContext,
    private readonly items: EntityButton[],
    private readonly mode: 'toggle' | 'scene',
    private readonly accent: string,
  ) {
    // 씬은 상태가 없어 자주 갱신할 필요가 없다
    this.refreshMs = mode === 'toggle' ? 2000 : 1000
  }

  async render(): Promise<Layout> {
    const layout = emptyLayout()
    const states = await this.ctx.hass.getStates()

    this.items.slice(0, MAX_ITEMS).forEach((item, i) => {
      if (this.mode === 'scene') {
        const firedAt = this.activated.get(item.entity)
        const justFired = firedAt !== undefined && Date.now() - firedAt < SCENE_FLASH_MS
        layout[i] = justFired
          ? { icon: 'check', label: item.label, fg: COLORS.green, accent: COLORS.green, bg: '#16261a' }
          : { icon: (item.icon as IconName) ?? 'scene', label: item.label, fg: COLORS.fg, accent: this.accent }
        return
      }

      const on = states.get(item.entity)?.state === 'on'
      layout[i] = {
        icon: (item.icon as IconName) ?? 'bulb',
        label: item.label,
        fg: on ? this.accent : COLORS.muted,
        bg: on ? '#241f12' : COLORS.bg,
        accent: on ? this.accent : undefined,
      }
    })

    layout[14] = homeButton()
    return layout
  }

  async onPress(index: number): Promise<void> {
    if (index === 14) return this.ctx.station.goHome()

    const item = this.items[index]
    if (!item) return

    if (this.mode === 'scene') {
      await this.ctx.hass.activateScene(item.entity)
      this.activated.set(item.entity, Date.now())
    } else {
      await this.ctx.hass.toggle(item.entity)
    }
  }
}
