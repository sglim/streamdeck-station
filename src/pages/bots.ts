import type { Page, Layout } from '../deck/station.js'
import { COLORS } from '../deck/render.js'
import { readJobs, kickstart, type JobStatus } from '../integrations/launchd.js'
import { emptyLayout, homeButton, type AppContext } from './context.js'

const MAX_BOTS = 14
const CONFIRM_TIMEOUT_MS = 4000

/**
 * launchd 잡(봇/자동화) 수동 실행 및 상태 표시.
 * 잡 실행은 외부로 글을 올리는 등 되돌릴 수 없는 동작이라 두 번 눌러야 실행된다.
 */
export class BotsPage implements Page {
  readonly id = 'bots'
  readonly refreshMs = 3000

  private jobs = new Map<string, JobStatus>()
  private confirming: string | null = null
  private confirmTimer: NodeJS.Timeout | null = null
  private launched = new Map<string, number>()

  constructor(private readonly ctx: AppContext) {}

  async onEnter(): Promise<void> {
    this.jobs = await readJobs()
  }

  onExit(): void {
    this.clearConfirm()
  }

  private get bots() {
    return this.ctx.config.bots.slice(0, MAX_BOTS)
  }

  async render(): Promise<Layout> {
    this.jobs = await readJobs()
    const layout = emptyLayout()

    this.bots.forEach((bot, i) => {
      if (i >= MAX_BOTS) return
      const slot = i < 14 ? i : i + 1
      const job = this.jobs.get(bot.job)
      layout[slot] = this.buttonFor(bot.label, bot.job, job)
    })

    layout[14] = homeButton()
    return layout
  }

  private buttonFor(label: string, jobName: string, job: JobStatus | undefined) {
    if (this.confirming === jobName) {
      return { label: '실행?', sub: label, bg: '#1a2e1a', fg: COLORS.green, accent: COLORS.green }
    }
    // 방금 실행 버튼을 눌렀으면 잠깐 표시해 준다
    const firedAt = this.launched.get(jobName)
    if (firedAt && Date.now() - firedAt < 5000) {
      return { icon: 'refresh' as const, label, sub: '실행함', fg: COLORS.cyan, accent: COLORS.cyan }
    }
    if (!job) {
      return { label, sub: '미등록', fg: COLORS.muted, dim: true }
    }
    if (job.pid !== null) {
      return { icon: 'refresh' as const, label, sub: '실행 중', fg: COLORS.cyan, accent: COLORS.cyan }
    }
    if (job.lastExit !== null && job.lastExit !== 0) {
      return { icon: 'cross' as const, label, sub: `종료 ${job.lastExit}`, fg: COLORS.red, accent: COLORS.red }
    }
    return { icon: 'bot' as const, label, fg: COLORS.fg, accent: COLORS.green }
  }

  async onPress(index: number): Promise<void> {
    if (index === 14) return this.ctx.station.goHome()

    const bot = this.bots[index]
    if (!bot) return

    if (this.confirming !== bot.job) {
      this.confirming = bot.job
      this.confirmTimer = setTimeout(() => {
        this.confirming = null
        this.ctx.station.requestDraw()
      }, CONFIRM_TIMEOUT_MS)
      this.confirmTimer.unref()
      return
    }

    this.clearConfirm()
    try {
      await kickstart(bot.job)
      this.launched.set(bot.job, Date.now())
    } catch (err) {
      console.error(`[bots] ${bot.job} 실행 실패:`, (err as Error).message)
    }
  }

  private clearConfirm(): void {
    if (this.confirmTimer) clearTimeout(this.confirmTimer)
    this.confirmTimer = null
    this.confirming = null
  }
}
