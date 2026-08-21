import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * 외부 명령을 실행하고 stdout을 돌려준다.
 * 버튼 하나가 멈추더라도 데몬 전체가 굳지 않도록 항상 타임아웃을 건다.
 */
export async function run(
  cmd: string,
  args: string[],
  timeoutMs = 5000,
): Promise<string> {
  const { stdout } = await execFileAsync(cmd, args, {
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
  })
  return stdout
}

/** 실패해도 예외를 던지지 않고 null을 돌려주는 버전 */
export async function tryRun(
  cmd: string,
  args: string[],
  timeoutMs = 5000,
): Promise<string | null> {
  try {
    return await run(cmd, args, timeoutMs)
  } catch (err) {
    console.error(`[exec] ${cmd} ${args.join(' ')} 실패:`, (err as Error).message)
    return null
  }
}

/** AppleScript 한 줄 실행 */
export async function osascript(script: string, timeoutMs = 5000): Promise<string | null> {
  const out = await tryRun('osascript', ['-e', script], timeoutMs)
  return out?.trim() ?? null
}
