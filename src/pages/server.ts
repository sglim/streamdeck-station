import type { Page, Layout } from '../deck/station.js'
import { COLORS } from '../deck/render.js'
import {
  readSystemStats, readContainers, restartContainer, formatUptime,
  type SystemStats, type Container,
} from '../integrations/system.js'
import { emptyLayout, homeButton, type AppContext } from './context.js'

const CONTAINER_SLOTS = 5
const CONFIRM_TIMEOUT_MS = 4000

/** 서버 상태: 부하·메모리·디스크·업타임 + 컨테이너 상태/재시작 */
export class ServerPage implements Page {
  readonly id = 'server'
  readonly refreshMs = 2000

  private stats: SystemStats | null = null
  private containers: Container[] = []
  /** 재시작 확인 대기 중인 컨테이너 이름 */
  private confirming: string | null = null
  private confirmTimer: NodeJS.Timeout | null = null
  private busy = new Set<string>()

  constructor(private readonly ctx: AppContext) {}

  async onEnter(): Promise<void> {
    await this.poll()
  }

  onExit(): void {
    this.clearConfirm()
  }

  private async poll(): Promise<void> {
    const [stats, containers] = await Promise.all([readSystemStats(), readContainers()])
    this.stats = stats
    this.containers = this.pickContainers(containers)
  }

  /** 설정에 나열된 컨테이너를 우선 순서대로, 없으면 발견된 순서대로 */
  private pickContainers(all: Container[]): Container[] {
    const wanted = this.ctx.config.containers
    if (wanted.length === 0) return all.slice(0, CONTAINER_SLOTS)
    const byName = new Map(all.map((c) => [c.name, c]))
    return wanted
      .map((name) => byName.get(name) ?? { name, running: false, status: '없음' })
      .slice(0, CONTAINER_SLOTS)
  }

  async render(): Promise<Layout> {
    await this.poll()
    const layout = emptyLayout()
    const s = this.stats

    if (s) {
      layout[0] = {
        value: `${Math.round(s.loadRatio * 100)}%`,
        label: '부하',
        gauge: s.loadRatio,
        accent: level(s.loadRatio),
      }
      layout[1] = {
        value: `${s.memUsedGB.toFixed(1)}G`,
        label: '메모리',
        gauge: s.memRatio,
        accent: level(s.memRatio),
      }
      layout[2] = {
        value: `${Math.round(s.diskRatio * 100)}%`,
        label: '디스크',
        sub: `${s.diskFreeGB.toFixed(0)}G 남음`,
        gauge: s.diskRatio,
        accent: level(s.diskRatio),
      }
      layout[3] = { icon: 'clock', label: '가동', sub: formatUptime(s.uptimeSec) }
    }

    this.containers.forEach((c, i) => {
      const slot = 5 + i
      if (slot > 9) return
      if (this.busy.has(c.name)) {
        layout[slot] = { icon: 'refresh', label: c.name, sub: '재시작 중', fg: COLORS.amber }
      } else if (this.confirming === c.name) {
        layout[slot] = { label: '재시작?', sub: c.name, bg: '#3a1a1a', fg: COLORS.red, accent: COLORS.red }
      } else {
        layout[slot] = {
          icon: c.running ? 'server' : 'cross',
          label: shortName(c.name),
          fg: c.running ? COLORS.green : COLORS.red,
          accent: c.running ? COLORS.green : COLORS.red,
        }
      }
    })

    layout[14] = homeButton()
    return layout
  }

  async onPress(index: number): Promise<void> {
    if (index === 14) return this.ctx.station.goHome()

    const c = this.containers[index - 5]
    if (index < 5 || index > 9 || !c || this.busy.has(c.name)) return

    // 첫 번째 누름은 확인 요청, 두 번째 누름에 실제로 재시작한다
    if (this.confirming !== c.name) {
      this.confirming = c.name
      this.confirmTimer = setTimeout(() => {
        this.confirming = null
        this.ctx.station.requestDraw()
      }, CONFIRM_TIMEOUT_MS)
      this.confirmTimer.unref()
      return
    }

    this.clearConfirm()
    this.busy.add(c.name)
    this.ctx.station.requestDraw()
    try {
      await restartContainer(c.name)
    } catch (err) {
      console.error(`[server] ${c.name} 재시작 실패:`, (err as Error).message)
    } finally {
      this.busy.delete(c.name)
    }
  }

  private clearConfirm(): void {
    if (this.confirmTimer) clearTimeout(this.confirmTimer)
    this.confirmTimer = null
    this.confirming = null
  }
}

/** 사용률에 따라 초록 → 노랑 → 빨강 */
function level(ratio: number): string {
  if (ratio > 0.9) return COLORS.red
  if (ratio > 0.7) return COLORS.amber
  return COLORS.green
}

/** 버튼에 들어갈 만큼 컨테이너 이름을 줄인다 */
function shortName(name: string): string {
  return name.length <= 10 ? name : name.slice(0, 9) + '…'
}
