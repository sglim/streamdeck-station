import { readFile } from 'node:fs/promises'
import { run, tryRun } from './exec.js'

export interface JobStatus {
  label: string
  /** 지금 실행 중이면 PID, 아니면 null */
  pid: number | null
  /** 마지막 종료 코드. 0이면 정상, null이면 아직 실행된 적 없음 */
  lastExit: number | null
}

const uid = process.getuid?.() ?? 501
const domain = `gui/${uid}`

/** launchctl list 전체를 한 번에 읽어 라벨별 상태 맵으로 만든다 */
export async function readJobs(): Promise<Map<string, JobStatus>> {
  const out = await tryRun('launchctl', ['list'], 5000)
  const map = new Map<string, JobStatus>()
  if (!out) return map

  for (const line of out.trim().split('\n').slice(1)) {
    const [pidRaw, exitRaw, label] = line.split('\t')
    if (!label) continue
    map.set(label, {
      label,
      pid: pidRaw === '-' ? null : Number(pidRaw),
      lastExit: exitRaw === '-' ? null : Number(exitRaw),
    })
  }
  return map
}

/** 잡을 지금 즉시 실행한다 (이미 돌고 있으면 재시작) */
export async function kickstart(label: string): Promise<void> {
  await run('launchctl', ['kickstart', '-k', `${domain}/${label}`], 15000)
}

/** 실행 중인 잡을 중단한다 */
export async function stopJob(label: string): Promise<void> {
  await tryRun('launchctl', ['kill', 'SIGTERM', `${domain}/${label}`], 10000)
}

/** 잡의 stdout 로그 경로를 plist에서 찾는다 */
export async function logPath(label: string): Promise<string | null> {
  const out = await tryRun('launchctl', ['print', `${domain}/${label}`], 5000)
  const m = out?.match(/stdout path\s*=\s*(.+)/)
  return m?.[1]?.trim() ?? null
}

/** 로그 마지막 몇 줄 */
export async function tailLog(label: string, lines = 3): Promise<string[]> {
  const path = await logPath(label)
  if (!path) return []
  try {
    const text = await readFile(path, 'utf8')
    return text.trimEnd().split('\n').slice(-lines)
  } catch {
    return []
  }
}
