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

export interface Page {
  readonly id: string
  /** 현재 상태를 15칸 레이아웃으로 그린다 */
  render(): Promise<Layout> | Layout
  /** 버튼이 눌렸을 때. 반환값이 없으면 렌더는 자동 갱신된다 */
  onPress?(index: number): void | Promise<void>
  /** 이 페이지가 떠 있는 동안 자동 갱신 주기(ms). 없으면 갱신 안 함 */
  readonly refreshMs?: number
  onEnter?(): void | Promise<void>
  onExit?(): void | Promise<void>
}

export class Station {
  private deck: StreamDeck | null = null
  private stack: Page[] = []
  private lastDrawn = new Map<number, string>()
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
    // 눌린 즉시 시각 피드백을 준 뒤 핸들러를 실행한다
    void this.flash(index)
    try {
      await page.onPress?.(index)
    } catch (err) {
      console.error(`[${page.id}] 버튼 ${index} 처리 실패:`, (err as Error).message)
    }
    this.requestDraw()
  }

  private async flash(index: number): Promise<void> {
    const deck = this.deck
    if (!deck) return
    try {
      await deck.fillKeyColor(index, 255, 255, 255)
      this.lastDrawn.delete(index)
    } catch { /* 렌더 중 장치가 빠진 경우 */ }
  }

  /** 페이지를 새로 쌓는다 */
  async push(page: Page): Promise<void> {
    await this.current?.onExit?.()
    this.stack.push(page)
    await page.onEnter?.()
    this.scheduleRefresh()
    await this.draw()
  }

  /** 이전 페이지로 돌아간다 (루트에서는 무시) */
  async pop(): Promise<void> {
    if (this.stack.length <= 1) return
    await this.stack.pop()!.onExit?.()
    await this.current?.onEnter?.()
    this.scheduleRefresh()
    await this.draw()
  }

  async goHome(): Promise<void> {
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
