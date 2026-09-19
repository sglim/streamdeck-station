import { listStreamDecks, openStreamDeck, type StreamDeck } from '@elgato-stream-deck/node'
import { renderButton, type ButtonSpec } from './render.js'

/** 15칸 레이아웃. 인덱스 0=좌상단, 14=우하단 (5열 x 3행). null = 빈 칸 */
export type Layout = (ButtonSpec | null)[]

export const COLS = 5
export const ROWS = 3
export const SLOTS = COLS * ROWS

/** "열,행" 좌표를 버튼 인덱스로 변환 */
export function at(col: number, row: number): number {
  return row * COLS + col
}

/** 이 시간 이상 누르고 있으면 «길게 누르기» 로 본다 */
const LONG_PRESS_MS = 600

export interface Page {
  readonly id: string
  /** 현재 상태를 15칸 레이아웃으로 그린다 */
  render(): Promise<Layout> | Layout
  /** 버튼이 눌렸을 때. 반환값이 없으면 렌더는 자동 갱신된다 */
  onPress?(index: number): void | Promise<void>
  /**
   * 길게 눌렀을 때. 이 핸들러를 가진 페이지는 짧은 누름이 «손을 뗄 때» 실행된다
   * (길게 누른 것인지 그때 알 수 있기 때문). 없으면 기존처럼 누르는 즉시 실행한다.
   */
  onLongPress?(index: number): void | Promise<void>
  /** 이 페이지가 떠 있는 동안 자동 갱신 주기(ms). 없으면 갱신 안 함 */
  readonly refreshMs?: number
  onEnter?(): void | Promise<void>
  onExit?(): void | Promise<void>
}

export class Station {
  private deck: StreamDeck | null = null
  private stack: Page[] = []
  private lastDrawn = new Map<number, string>()
  /** 마지막으로 그린 스펙. 버튼을 누른 즉시 로딩 표시를 겹쳐 그리는 데 쓴다. */
  private lastSpec = new Map<number, ButtonSpec | null>()
  /** 길게 누르기 판정용 타이머 (키를 누르고 있는 동안) */
  private holdTimers = new Map<number, NodeJS.Timeout>()
  /** 이미 길게 누르기로 처리된 키 — 손을 뗄 때 짧은 누름이 또 실행되지 않게 한다 */
  private longFired = new Set<number>()
  private refreshTimer: NodeJS.Timeout | null = null
  private renderPending = false
  private rendering = false
  private closed = false

  constructor(private readonly brightness: number) {}

  get current(): Page | undefined {
    return this.stack[this.stack.length - 1]
  }

  async start(root: Page): Promise<void> {
    this.stack = [root]
    await this.connect()
    await root.onEnter?.()
    this.scheduleRefresh()
    await this.draw()
  }

  /** 장치를 열고 이벤트를 연결한다. 실패 시 5초 간격으로 재시도. */
  private async connect(): Promise<void> {
    while (!this.closed) {
      try {
        const [info] = await listStreamDecks()
        if (!info) throw new Error('Stream Deck을 찾을 수 없습니다')
        const deck = await openStreamDeck(info.path)
        this.deck = deck
        await deck.setBrightness(this.brightness)
        deck.on('down', (c) => { void this.handleDown(c.index) })
        deck.on('up', (c) => { void this.handleUp(c.index) })
        deck.on('error', (err) => {
          console.error('[deck] 오류:', err)
          void this.reconnect()
        })
        this.lastDrawn.clear()
        console.log(`[deck] 연결됨: ${deck.PRODUCT_NAME} (${info.serialNumber})`)
        return
      } catch (err) {
        console.error('[deck] 연결 실패, 5초 후 재시도:', (err as Error).message)
        await sleep(5000)
      }
    }
  }

  private async reconnect(): Promise<void> {
    if (this.closed || !this.deck) return
    const old = this.deck
    this.deck = null
    try { await old.close() } catch { /* 이미 끊긴 장치 */ }
    await this.connect()
    await this.draw()
  }

  private async handleDown(index: number): Promise<void> {
    const page = this.current
    if (!page) return

    // 길게 누르기를 쓰지 않는 페이지는 기존대로 누르는 즉시 실행한다
    if (!page.onLongPress) {
      void this.paintBusy(index)
      await this.firePress(index)
      return
    }

    // 길게 누르기 페이지: 임계 시간이 지나면 그 자리에서 길게 누르기로 처리하고,
    // 그 전에 손을 떼면 handleUp 이 짧은 누름으로 처리한다.
    const timer = setTimeout(() => {
      this.holdTimers.delete(index)
      this.longFired.add(index)
      void this.paintBusy(index)
      void this.fireLongPress(index)
    }, LONG_PRESS_MS)
    timer.unref()
    this.holdTimers.set(index, timer)
  }

  private async handleUp(index: number): Promise<void> {
    const timer = this.holdTimers.get(index)
    if (timer) {
      clearTimeout(timer)
      this.holdTimers.delete(index)
      // 임계 시간 전에 뗐으므로 짧은 누름이다
      void this.paintBusy(index)
      await this.firePress(index)
    }
    this.longFired.delete(index)
  }

  private async firePress(index: number): Promise<void> {
    const page = this.current
    if (!page) return
    try {
      await page.onPress?.(index)
    } catch (err) {
      console.error(`[${page.id}] 버튼 ${index} 처리 실패:`, (err as Error).message)
    }
    this.requestDraw()
  }

  private async fireLongPress(index: number): Promise<void> {
    const page = this.current
    if (!page) return
    try {
      await page.onLongPress?.(index)
    } catch (err) {
      console.error(`[${page.id}] 버튼 ${index} 길게 누르기 실패:`, (err as Error).message)
    }
    this.requestDraw()
  }

  private async paintBusy(index: number): Promise<void> {
    const deck = this.deck
    if (!deck) return
    const spec = this.lastSpec.get(index) ?? null
    try {
      if (spec) {
        await deck.fillKeyBuffer(index, await renderButton({ ...spec, busy: true }), { format: 'rgba' })
      } else {
        await deck.fillKeyColor(index, 40, 34, 10)
      }
      // 실제 결과가 나오면 신호가 같더라도 반드시 다시 그리도록 무효화한다
      this.lastDrawn.delete(index)
    } catch { /* 렌더 중 장치가 빠진 경우 */ }
  }

  /** 눌린 채로 페이지가 바뀌면 타이머가 남아 엉뚱한 페이지에서 실행될 수 있다 */
  private clearHolds(): void {
    for (const t of this.holdTimers.values()) clearTimeout(t)
    this.holdTimers.clear()
    this.longFired.clear()
  }

  /** 페이지를 새로 쌓는다 */
  async push(page: Page): Promise<void> {
    this.clearHolds()
    await this.current?.onExit?.()
    this.stack.push(page)
    await page.onEnter?.()
    this.scheduleRefresh()
    await this.draw()
  }

  /** 이전 페이지로 돌아간다 (루트에서는 무시) */
  async pop(): Promise<void> {
    this.clearHolds()
    if (this.stack.length <= 1) return
    await this.stack.pop()!.onExit?.()
    await this.current?.onEnter?.()
    this.scheduleRefresh()
    await this.draw()
  }

  async goHome(): Promise<void> {
    this.clearHolds()
    while (this.stack.length > 1) {
      await this.stack.pop()!.onExit?.()
    }
    await this.current?.onEnter?.()
    this.scheduleRefresh()
    await this.draw()
  }

  /** 패널 밝기를 바꾼다 (0~100) */
  async setBrightness(percent: number): Promise<void> {
    try {
      await this.deck?.setBrightness(Math.max(0, Math.min(100, Math.round(percent))))
    } catch (err) {
      console.error('[deck] 밝기 변경 실패:', (err as Error).message)
    }
  }

  /** 다음 tick에 한 번만 다시 그린다 (중복 요청 병합) */
  requestDraw(): void {
    if (this.renderPending) return
    this.renderPending = true
    setImmediate(() => {
      this.renderPending = false
      void this.draw()
    })
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer)
    this.refreshTimer = null
    const ms = this.current?.refreshMs
    if (ms) {
      this.refreshTimer = setInterval(() => this.requestDraw(), ms)
      this.refreshTimer.unref()
    }
  }

  /** 현재 페이지를 그린다. 직전과 동일한 칸은 건너뛴다. */
  private async draw(): Promise<void> {
    if (this.rendering) { this.requestDraw(); return }
    const deck = this.deck
    const page = this.current
    if (!deck || !page) return

    this.rendering = true
    try {
      const layout = await page.render()
      for (let i = 0; i < SLOTS; i++) {
        const spec = layout[i] ?? null
        const sig = spec ? JSON.stringify(spec) : 'null'
        if (this.lastDrawn.get(i) === sig) continue
        if (spec) {
          await deck.fillKeyBuffer(i, await renderButton(spec), { format: 'rgba' })
        } else {
          await deck.fillKeyColor(i, 0, 0, 0)
        }
        this.lastDrawn.set(i, sig)
        this.lastSpec.set(i, spec)
      }
    } catch (err) {
      console.error(`[${page.id}] 렌더 실패:`, (err as Error).message)
    } finally {
      this.rendering = false
    }
  }

  async shutdown(): Promise<void> {
    this.closed = true
    if (this.refreshTimer) clearInterval(this.refreshTimer)
    const deck = this.deck
    this.deck = null
    if (!deck) return
    try {
      await deck.clearPanel()
      await deck.close()
    } catch { /* 이미 닫힌 경우 */ }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
