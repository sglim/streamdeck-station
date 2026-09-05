import type { Page, Layout } from '../deck/station.js'
import { COLORS } from '../deck/render.js'
import {
  readSystemStats, readMacmon, readBattery, type BatteryInfo,
} from '../integrations/system.js'
import { emptyLayout, homeButton, type AppContext } from './context.js'

/**
 * 상세 부하 페이지. 홈/서버의 부하 버튼을 누르면 열린다.
 * 홈의 부하 %는 "1분 평균 대기 작업 수 ÷ 코어 수"라 100%를 넘을 수 있는데,
 * 여기서는 실제 코어 사용률(0~100%)과 전력·팬·배터리를 보여준다.
 */
export class StatsPage implements Page {
  readonly id = 'stats'
  readonly refreshMs = 2000

  private battery: BatteryInfo | null = null

  constructor(private readonly ctx: AppContext) {}

  async render(): Promise<Layout> {
    const layout = emptyLayout()
    const m = readMacmon()
    const [stats, battery] = await Promise.all([readSystemStats(), readBattery()])
    this.battery = battery

    if (m) {
      layout[0] = usage('E코어', m.ecpuPct, `${Math.round(m.ecpuMhz)}MHz`)
      layout[1] = usage('P코어', m.pcpuPct, `${Math.round(m.pcpuMhz)}MHz`)
      layout[2] = usage('GPU', m.gpuPct)
      layout[3] = {
        value: `${Math.round(m.cpuTempC)}°`,
        label: 'CPU 온도',
        gauge: m.cpuTempC / 100,
        accent: m.cpuTempC > 85 ? COLORS.red : m.cpuTempC > 70 ? COLORS.amber : COLORS.green,
      }
      layout[4] = {
        value: `${Math.round(m.fanRpm)}`,
        label: '팬 RPM',
        gauge: m.fanMaxRpm > 0 ? m.fanRpm / m.fanMaxRpm : 0,
        accent: COLORS.cyan,
      }
      layout[5] = watts('CPU 전력', m.cpuPowerW)
      layout[6] = watts('GPU 전력', m.gpuPowerW)
      layout[7] = watts('ANE 전력', m.anePowerW)
      layout[8] = watts('전체 전력', m.sysPowerW)
    } else {
      layout[0] = { icon: 'cpu', label: '측정 중', sub: 'macmon', dim: true }
    }

    layout[9] = {
      value: stats.load1.toFixed(1),
      label: '부하 1분',
      sub: `코어당 ${Math.round(stats.loadRatio * 100)}%`,
      accent: stats.loadRatio > 1 ? COLORS.red : COLORS.green,
    }

    if (this.battery) {
      const b = this.battery
      layout[10] = {
        value: `${b.percent}%`,
        label: '배터리',
        sub: b.charging ? '충전 중' : '대기',
        gauge: b.percent / 100,
        accent: b.percent < 20 ? COLORS.red : COLORS.green,
      }
      layout[11] = {
        value: `${b.tempC.toFixed(1)}°`,
        label: '배터리 온도',
        accent: b.tempC > 40 ? COLORS.amber : COLORS.muted,
      }
      layout[12] = { value: `${b.cycles}`, label: '사이클', accent: COLORS.muted }
    }

    layout[14] = homeButton()
    return layout
  }

  async onPress(index: number): Promise<void> {
    if (index === 14) return this.ctx.station.goHome()
  }
}

/** 사용률(0~1)을 % 버튼으로 */
function usage(label: string, ratio: number, sub?: string) {
  const pct = Math.round(ratio * 100)
  return {
    value: `${pct}%`,
    label,
    sub,
    gauge: ratio,
    accent: ratio > 0.85 ? COLORS.red : ratio > 0.6 ? COLORS.amber : COLORS.green,
  }
}

function watts(label: string, w: number) {
  return { value: `${w.toFixed(1)}W`, label, accent: COLORS.blue }
}
