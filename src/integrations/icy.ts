/**
 * 인터넷 라디오 스트림의 ICY 메타데이터에서 현재 곡을 읽는다.
 *
 * Cast 기본 리시버는 스트림에 실린 곡 정보를 HA로 넘겨주지 않아
 * media_title 이 늘 비어 있다. 그래서 데몬이 스트림에 직접 붙어
 * 첫 메타데이터 블록만 읽고 끊는다.
 */

export interface NowPlaying {
  /** "연주자 - 곡명" 원문 */
  text: string
  artist?: string
  title?: string
}

interface CacheEntry {
  value: NowPlaying | null
  at: number
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<NowPlaying | null>>()

/** 같은 URL을 이 간격 안에 다시 물으면 캐시를 준다 (스트림에 매번 붙지 않도록) */
const TTL_MS = 20_000

/**
 * 스트림에서 현재 곡을 읽는다. 실패하거나 메타데이터가 없으면 null.
 * 화면 갱신 주기마다 호출되므로 캐시와 중복 요청 병합이 필수다.
 */
export async function readNowPlaying(url: string): Promise<NowPlaying | null> {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value

  const existing = inflight.get(url)
  if (existing) return existing

  const task = fetchNowPlaying(url)
    .then((value) => {
      cache.set(url, { value, at: Date.now() })
      return value
    })
    .catch(() => {
      // 실패도 캐시해서 매 갱신마다 재시도하지 않게 한다
      cache.set(url, { value: null, at: Date.now() })
      return null
    })
    .finally(() => {
      inflight.delete(url)
    })

  inflight.set(url, task)
  return task
}

/**
 * 캐시에 있는 값만 즉시 돌려준다.
 * 화면 렌더가 네트워크 응답을 기다리며 멈추지 않도록 조회와 갱신을 나눠 둔다.
 */
export function peekNowPlaying(url: string): NowPlaying | null {
  return cache.get(url)?.value ?? null
}

/** 캐시가 오래됐으면 백그라운드로 갱신을 시작한다 (결과는 다음 렌더에 반영된다) */
export function refreshNowPlaying(url: string): void {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < TTL_MS) return
  void readNowPlaying(url)
}

async function fetchNowPlaying(url: string): Promise<NowPlaying | null> {
  const res = await fetch(url, {
    headers: { 'Icy-MetaData': '1', 'User-Agent': 'streamdeck-station/0.1' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok || !res.body) return null

  const interval = Number(res.headers.get('icy-metaint') ?? 0)
  if (!interval) {
    await res.body.cancel()
    return null
  }

  try {
    const meta = await readFirstMetadata(res.body, interval)
    return meta ? parseStreamTitle(meta) : null
  } finally {
    // 오디오를 계속 받지 않도록 반드시 끊는다
    await res.body.cancel().catch(() => {})
  }
}

/**
 * 오디오 interval 바이트를 건너뛴 뒤 메타데이터 블록을 읽는다.
 * 블록의 첫 바이트가 길이이며, 실제 길이는 그 값 × 16 바이트다.
 */
async function readFirstMetadata(
  body: ReadableStream<Uint8Array>,
  interval: number,
): Promise<string | null> {
  const reader = body.getReader()
  let skipped = 0
  let pending: Uint8Array<ArrayBufferLike> = new Uint8Array(0)

  // 메타데이터가 시작되는 지점까지 오디오를 흘려보낸다
  while (skipped < interval) {
    const { done, value } = await reader.read()
    if (done || !value) return null
    const need = interval - skipped
    if (value.length <= need) {
      skipped += value.length
    } else {
      skipped = interval
      pending = value.subarray(need)
    }
  }

  const lengthByte = await readBytes(reader, pending, 1)
  if (!lengthByte) return null
  const size = lengthByte.chunk[0]! * 16
  if (size === 0) return null

  const block = await readBytes(reader, lengthByte.rest, size)
  if (!block) return null

  return new TextDecoder().decode(block.chunk).replace(/\0+$/, '').trim()
}

/** 남은 버퍼를 먼저 쓰고, 모자라면 스트림에서 더 읽어 정확히 count 바이트를 채운다 */
async function readBytes(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  buffered: Uint8Array,
  count: number,
): Promise<{ chunk: Uint8Array; rest: Uint8Array } | null> {
  let buf = buffered
  while (buf.length < count) {
    const { done, value } = await reader.read()
    if (done || !value) return null
    const merged = new Uint8Array(buf.length + value.length)
    merged.set(buf)
    merged.set(value, buf.length)
    buf = merged
  }
  return { chunk: buf.subarray(0, count), rest: buf.subarray(count) }
}

/** StreamTitle='아티스트 - 제목'; 형태를 갈라낸다 */
function parseStreamTitle(meta: string): NowPlaying | null {
  const m = meta.match(/StreamTitle='([^']*)'/)
  const text = m?.[1]?.trim()
  if (!text) return null

  const dash = text.indexOf(' - ')
  if (dash > 0) {
    return {
      text,
      artist: text.slice(0, dash).trim(),
      title: text.slice(dash + 3).trim(),
    }
  }
  return { text, title: text }
}
