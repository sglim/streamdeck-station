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
/** 낙관적 상태를 유지하는 최대 시간. 실패해도 결국엔 실제 상태로 돌아오게 한다 */
const OPTIMISTIC_TIMEOUT_MS = 10_000

export class EntityPage implements Page {
  readonly refreshMs: number
  private activated = new Map<string, number>()
  /**
   * 토글 직후 화면에 낙관적으로 보여줄 상태.
   * SmartThings는 클라우드 왕복이 있어 토글 직후 다시 물어보면 HA 백엔드
   * 자체가 아직 갱신 전이라 이전 상태가 돌아온다. 그대로 그리면 누를 때마다
   * 표시와 실제 상태가 엇갈려 보이므로, 실제 상태가 따라올 때까지 미리 보여준다.
   */
  private optimistic = new Map<string, { on: boolean; until: number }>()

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

      const on = this.resolveOn(item.entity, states.get(item.entity)?.state === 'on')
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
      // 연타해도 어긋나지 않도록, 원시 상태가 아니라 지금 화면에 보이는
      // (낙관적 상태 포함) 값을 기준으로 다음 상태를 정한다
      const state = await this.ctx.hass.get(item.entity)
      const shownOn = this.resolveOn(item.entity, state?.state === 'on')
      this.optimistic.set(item.entity, { on: !shownOn, until: Date.now() + OPTIMISTIC_TIMEOUT_MS })
      await this.ctx.hass.toggle(item.entity)
    }
  }

  /** 낙관적 상태가 있으면 그걸, 실제 상태가 따라잡았거나 만료됐으면 실제 상태를 쓴다 */
  private resolveOn(entity: string, actual: boolean): boolean {
    const pending = this.optimistic.get(entity)
    if (!pending) return actual
    if (actual === pending.on || Date.now() > pending.until) {
      this.optimistic.delete(entity)
      return actual
    }
    return pending.on
  }
}
