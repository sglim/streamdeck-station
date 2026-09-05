import { run, tryRun } from './exec.js'

export interface SystemStats {
  /** 1분 평균 부하를 코어 수로 나눈 값 (0~1+) */
  loadRatio: number
  load1: number
  /** 사용 중 메모리 비율 0~1 */
  memRatio: number
  memUsedGB: number
  memTotalGB: number
  /** 루트 디스크 사용률 0~1 */
  diskRatio: number
  diskFreeGB: number
  /** 부팅 후 경과 시간 (초) */
  uptimeSec: number
}

const PAGE_SIZE = 16384
let cpuCount = 8

export async function readSystemStats(): Promise<SystemStats> {
  const [loadRaw, vmRaw, dfRaw, ncpuRaw, memRaw, bootRaw] = await Promise.all([
    tryRun('sysctl', ['-n', 'vm.loadavg'], 2000),
    tryRun('vm_stat', [], 2000),
    tryRun('df', ['-k', '/'], 2000),
    tryRun('sysctl', ['-n', 'hw.ncpu'], 2000),
    tryRun('sysctl', ['-n', 'hw.memsize'], 2000),
    tryRun('sysctl', ['-n', 'kern.boottime'], 2000),
  ])

  if (ncpuRaw) cpuCount = Number(ncpuRaw.trim()) || cpuCount
  const load1 = loadRaw ? Number(loadRaw.replace(/[{}]/g, '').trim().split(/\s+/)[0]) || 0 : 0
  const memTotal = memRaw ? Number(memRaw.trim()) : 0

  // vm_stat의 active + wired 를 "사용 중"으로 본다 (Activity Monitor의 앱 메모리에 가깝다)
  let used = 0
  if (vmRaw) {
    const pages = (name: string): number => {
      const m = vmRaw.match(new RegExp(`${name}:\\s+(\\d+)`))
      return m ? Number(m[1]) : 0
    }
    used = (pages('Pages active') + pages('Pages wired down')) * PAGE_SIZE
  }

  // df 출력: Filesystem 1K-blocks Used Available Capacity ... Mounted
  let diskRatio = 0
  let diskFreeGB = 0
  if (dfRaw) {
    const cols = dfRaw.trim().split('\n').pop()!.split(/\s+/)
    const usedK = Number(cols[2]) || 0
    const availK = Number(cols[3]) || 0
    diskRatio = usedK + availK > 0 ? usedK / (usedK + availK) : 0
    diskFreeGB = availK / 1024 / 1024
  }

  let uptimeSec = 0
  if (bootRaw) {
    const m = bootRaw.match(/sec\s*=\s*(\d+)/)
    if (m) uptimeSec = Math.floor(Date.now() / 1000) - Number(m[1])
  }

  return {
    load1,
    loadRatio: load1 / cpuCount,
    memRatio: memTotal > 0 ? used / memTotal : 0,
    memUsedGB: used / 1024 ** 3,
    memTotalGB: memTotal / 1024 ** 3,
    diskRatio,
    diskFreeGB,
    uptimeSec,
  }
}

export interface Container {
  name: string
  running: boolean
  status: string
}

/** colima/docker 컨테이너 목록. docker가 없거나 죽어 있으면 빈 배열. */
export async function readContainers(): Promise<Container[]> {
  const out = await tryRun('docker', ['ps', '-a', '--format', '{{.Names}}\t{{.State}}\t{{.Status}}'], 8000)
  if (!out) return []
  return out
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name = '', state = '', status = ''] = line.split('\t')
      return { name, running: state === 'running', status }
    })
}

export async function restartContainer(name: string): Promise<void> {
  await run('docker', ['restart', name], 60000)
}

export interface MacmonStats {
  cpuTempC: number
  gpuTempC: number
  cpuPowerW: number
  gpuPowerW: number
  anePowerW: number
  sysPowerW: number
  /** 사용률 0~1 */
  ecpuPct: number
  ecpuMhz: number
  pcpuPct: number
  pcpuMhz: number
  gpuPct: number
  fanRpm: number
  fanMaxRpm: number
}

let macmonCache: { value: MacmonStats | null; at: number } = { value: null, at: 0 }
let macmonInflight = false
const MACMON_TTL_MS = 5_000

/**
 * macmon 하드웨어 지표 (Apple Silicon 은 온도·코어별 사용률을 주는 표준
 * 명령이 없다). 샘플링에 1초쯤 걸리므로 렌더를 막지 않도록 백그라운드로
 * 갱신하고 캐시를 돌려준다. macmon 이 없거나 실패하면 null.
 */
export function readMacmon(): MacmonStats | null {
  if (Date.now() - macmonCache.at > MACMON_TTL_MS && !macmonInflight) {
    macmonInflight = true
    void tryRun('macmon', ['pipe', '-s', '1'], 8000)
      .then((out) => {
        let value: MacmonStats | null = null
        try {
          const d = out ? JSON.parse(out.trim().split('\n')[0]!) : null
          if (d?.temp) {
            const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
            value = {
              cpuTempC: n(d.temp.cpu_temp_avg),
              gpuTempC: n(d.temp.gpu_temp_avg),
              cpuPowerW: n(d.cpu_power),
              gpuPowerW: n(d.gpu_power),
              anePowerW: n(d.ane_power),
              sysPowerW: n(d.sys_power),
              ecpuMhz: n(d.ecpu_usage?.[0]),
              ecpuPct: n(d.ecpu_usage?.[1]),
              pcpuMhz: n(d.pcpu_usage?.[0]),
              pcpuPct: n(d.pcpu_usage?.[1]),
              gpuPct: n(d.gpu_usage?.[1]),
              fanRpm: n(d.fans?.[0]?.rpm),
              fanMaxRpm: n(d.fans?.[0]?.max_rpm),
            }
          }
        } catch { /* 출력 형식이 바뀐 경우 */ }
        macmonCache = { value, at: Date.now() }
      })
      .finally(() => { macmonInflight = false })
  }
  return macmonCache.value
}

/** CPU 온도(°C). macmon 캐시에서 꺼낸다. */
export function readCpuTemp(): number | null {
  const t = readMacmon()?.cpuTempC
  return t !== undefined && t > 0 ? t : null
}

export interface BatteryInfo {
  percent: number
  charging: boolean
  tempC: number
  cycles: number
}

/** 배터리 상태 (ioreg AppleSmartBattery) */
export async function readBattery(): Promise<BatteryInfo | null> {
  const out = await tryRun('ioreg', ['-rn', 'AppleSmartBattery'], 4000)
  if (!out) return null
  const num = (key: string): number | null => {
    const m = out.match(new RegExp(`"${key}" = (-?\\d+)`))
    return m ? Number(m[1]) : null
  }
  const percent = num('CurrentCapacity')
  if (percent === null) return null
  return {
    percent,
    charging: /"IsCharging" = Yes/.test(out),
    tempC: (num('Temperature') ?? 0) / 100,
    cycles: num('CycleCount') ?? 0,
  }
}

/** 초를 "3일 4시간" 같은 짧은 한글 표기로 */
export function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}일 ${h}시간`
  if (h > 0) return `${h}시간 ${m}분`
  return `${m}분`
}
