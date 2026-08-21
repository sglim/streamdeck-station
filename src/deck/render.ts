import sharp from 'sharp'

/** Stream Deck MK.2 버튼 한 칸의 픽셀 크기 */
export const KEY_SIZE = 72

export interface ButtonSpec {
  /** 주 라벨 (한 줄, 길면 자동 축약) */
  label?: string
  /** 라벨 아래 작은 보조 문구 */
  sub?: string
  /** 라벨 위에 크게 표시할 값 (모니터링용, 예: "63%") */
  value?: string
  /** 내장 아이콘 이름 */
  icon?: IconName
  /** 배경색 */
  bg?: string
  /** 글자·아이콘 색 */
  fg?: string
  /** 상단 상태 띠 색 (없으면 안 그림) */
  accent?: string
  /** 하단 게이지 0~1 (없으면 안 그림) */
  gauge?: number
  /** 눌린 직후 강조 표시 */
  pressed?: boolean
  /** 비활성(흐리게) */
  dim?: boolean
  /** 명령을 보내고 결과를 기다리는 중 (상단에 로딩 점 표시) */
  busy?: boolean
}

export const COLORS = {
  bg: '#12131a',
  bgAlt: '#1b1d28',
  fg: '#e8e9f0',
  muted: '#6b6f80',
  green: '#3ddc84',
  red: '#ff5c5c',
  amber: '#ffb648',
  blue: '#4aa3ff',
  purple: '#a97bff',
  cyan: '#38d9d9',
} as const

export type IconName = keyof typeof ICONS

/**
 * 24x24 좌표계 SVG path. 라벨과 함께 버튼 위쪽에 그려진다.
 * 기호 문자 대신 path를 쓰는 이유는 폰트에 따라 글리프가 빠질 수 있기 때문.
 */
const ICONS = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
  next: 'M6 5l9 7-9 7zm11 0h2v14h-2z',
  prev: 'M18 5l-9 7 9 7zM5 5h2v14H5z',
  stop: 'M6 6h12v12H6z',
  volUp: 'M4 9v6h4l5 4V5L8 9H4zm12.5 3a4 4 0 00-2-3.5v7a4 4 0 002-3.5zM19 6.5v1.7a5.8 5.8 0 010 7.6v1.7a7.5 7.5 0 000-11z',
  volDown: 'M4 9v6h4l5 4V5L8 9H4zm12.5 3a4 4 0 00-2-3.5v7a4 4 0 002-3.5z',
  mute: 'M4 9v6h4l5 4V5L8 9H4zm11 1.4l1.4-1.4 5.2 5.2-1.4 1.4z M21.6 10.2l-1.4-1.4-5.2 5.2 1.4 1.4z',
  radio: 'M12 2a3 3 0 013 3 3 3 0 01-3 3 3 3 0 01-3-3 3 3 0 013-3zM4 9h16a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2v-9a2 2 0 012-2zm4 4a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm8 0h3v2h-3zm0 4h3v2h-3z',
  speaker: 'M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zm5 3a2 2 0 100 4 2 2 0 000-4zm0 6a4 4 0 100 8 4 4 0 000-8z',
  bulb: 'M12 2a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2zM9 19h6v1a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  scene: 'M12 2l2.6 6.3L21 9l-5 4.3L17.5 20 12 16.6 6.5 20 8 13.3 3 9l6.4-.7z',
  power: 'M12 3a1.5 1.5 0 011.5 1.5v7a1.5 1.5 0 01-3 0v-7A1.5 1.5 0 0112 3zM6.5 6.8A9 9 0 1017.5 6.8l-1.6 2A6.5 6.5 0 118 8.8z',
  curtain: 'M3 3h18v2H3zm2 3h4v15H5zm10 0h4v15h-4zM10 6h4v9h-4z',
  fan: 'M12 11a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6zM12 2c2.5 0 4 1.6 4 3.4 0 1.6-1.2 2.7-2.7 3.9C14.8 8.6 16.4 8 18 8.6c1.7.6 2.6 2.4 2 4-.6 1.5-2.3 2.2-4.2 1.9 1.3.9 2.4 2.2 2 3.8-.5 1.7-2.4 2.5-3.9 1.7-1.4-.7-1.8-2.3-1.9-4-.1 1.7-.5 3.3-1.9 4-1.5.8-3.4 0-3.9-1.7-.4-1.6.7-2.9 2-3.8-1.9.3-3.6-.4-4.2-1.9-.6-1.6.3-3.4 2-4 1.6-.6 3.2 0 4.7 1.1C9.2 8.1 8 7 8 5.4 8 3.6 9.5 2 12 2z',
  server: 'M4 3h16a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1zm2 3v1h2V6zm-2 8h16a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1v-5a1 1 0 011-1zm2 3v1h2v-1z',
  cpu: 'M9 2h2v2h2V2h2v2h1a2 2 0 012 2v1h2v2h-2v2h2v2h-2v2h2v2h-2v1a2 2 0 01-2 2h-1v2h-2v-2h-2v2H9v-2H8a2 2 0 01-2-2v-1H4v-2h2v-2H4v-2h2V9H4V7h2V6a2 2 0 012-2h1zm0 5v10h6V7z',
  disk: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 6a3 3 0 110 6 3 3 0 010-6z',
  bot: 'M12 2a1.5 1.5 0 011.5 1.5V5h3A2.5 2.5 0 0119 7.5v9a2.5 2.5 0 01-2.5 2.5h-9A2.5 2.5 0 015 16.5v-9A2.5 2.5 0 017.5 5h3V3.5A1.5 1.5 0 0112 2zM9 9.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM8.5 15h7v1.5h-7z',
  refresh: 'M12 4a8 8 0 017.5 5.3l-2 .7A6 6 0 006 9.4V7H4v6h6v-2H7.3A6 6 0 0112 6zm6 5v2h2.7A6 6 0 0112 18a6 6 0 01-5.5-3.6l-1.9.8A8 8 0 0020 14.6V17h2v-8z',
  home: 'M12 3l9 8h-3v9h-4v-6h-4v6H6v-9H3z',
  back: 'M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z',
  check: 'M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  cross: 'M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z',
  clock: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 2.2a7.8 7.8 0 110 15.6 7.8 7.8 0 010-15.6zM11 6.5h2v5.9l3.6 2.1-1 1.7-4.6-2.7z',
  chart: 'M4 20h16v2H4zM6 12h3v7H6zm5-6h3v13h-3zm5 3h3v10h-3z',
  // 날씨 아이콘 (HA weather 상태용)
  sun: 'M12 6.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM11 1h2v3h-2zM11 20h2v3h-2zM1 11h3v2H1zM20 11h3v2h-3zM3.2 4.6l1.4-1.4 2.2 2.2-1.4 1.4zM17.2 18.6l1.4-1.4 2.2 2.2-1.4 1.4zM3.2 19.4l2.2-2.2 1.4 1.4-2.2 2.2zM17.2 5.4l2.2-2.2 1.4 1.4-2.2 2.2z',
  moon: 'M20.6 13.5A8.5 8.5 0 1110.5 3.4a7 7 0 1010.1 10.1z',
  cloud: 'M19.35 10.04A7.49 7.49 0 0012 4 7.48 7.48 0 005.35 8.04 5.994 5.994 0 006 20h13a5 5 0 00.35-9.96z',
  cloudSun: 'M17 4.2a3.6 3.6 0 100 7.2 3.6 3.6 0 000-7.2zM16 0.5h2v2.5h-2zM21 6.8h2.5v2H21zM19.8 2.2l1.4-1.4 1.4 1.4-1.4 1.4zM16.8 20.5H5.6a3.9 3.9 0 01-.6-7.7 5.5 5.5 0 0110.7-1.4 3.7 3.7 0 011.1 9.1z',
  rain: 'M18.2 7.9a6.3 6.3 0 00-12.2-1.7A5 5 0 007 16.1h10.5a4.2 4.2 0 00.7-8.2zM7.4 17.8l-1.6 3.4 1.8.9 1.6-3.5zM11.9 17.8l-1.6 3.4 1.8.9 1.6-3.5zM16.4 17.8l-1.6 3.4 1.8.9 1.6-3.5z',
  snow: 'M18.2 7.9a6.3 6.3 0 00-12.2-1.7A5 5 0 007 16.1h10.5a4.2 4.2 0 00.7-8.2zM7.5 18.4a1.7 1.7 0 100 3.4 1.7 1.7 0 000-3.4zM12 18.4a1.7 1.7 0 100 3.4 1.7 1.7 0 000-3.4zM16.5 18.4a1.7 1.7 0 100 3.4 1.7 1.7 0 000-3.4z',
  storm: 'M18.2 7.9a6.3 6.3 0 00-12.2-1.7A5 5 0 007 16.1h10.5a4.2 4.2 0 00.7-8.2zM13.2 16.5l-4 5.1h2.4l-1.4 2.9 4.8-5.5h-2.5l2.1-2.5z',
  fog: 'M3 8h18v2H3zM5 12h14v2H5zM3 16h18v2H3zM6 20h12v2H6z',
} as const

const cache = new Map<string, Buffer>()

/**
 * ButtonSpec을 72x72 raw RGBA 버퍼로 렌더링한다.
 * fillKeyBuffer가 PNG가 아닌 raw 픽셀만 받기 때문에 raw로 낸다. 동일 스펙은 캐시된다.
 */
export async function renderButton(spec: ButtonSpec): Promise<Buffer> {
  const key = JSON.stringify(spec)
  const hit = cache.get(key)
  if (hit) return hit

  const raw = await sharp(Buffer.from(buildSvg(spec)))
    .resize(KEY_SIZE, KEY_SIZE)
    .ensureAlpha()
    .raw()
    .toBuffer()
  // 캐시가 무한정 커지지 않도록 상한을 둔다 (값이 매초 바뀌는 모니터링 버튼 대비)
  if (cache.size > 400) cache.clear()
  cache.set(key, raw)
  return raw
}

function buildSvg(spec: ButtonSpec): string {
  const bg = spec.pressed ? lighten(spec.bg ?? COLORS.bg) : (spec.bg ?? COLORS.bg)
  const fg = spec.dim ? COLORS.muted : (spec.fg ?? COLORS.fg)
  const parts: string[] = [
    `<rect width="72" height="72" rx="8" fill="${bg}"/>`,
  ]

  if (spec.accent) {
    parts.push(`<rect x="6" y="4" width="60" height="3" rx="1.5" fill="${spec.accent}"/>`)
  }

  const hasLabel = Boolean(spec.label)
  const hasSub = Boolean(spec.sub)

  if (spec.value) {
    // 값 중심 버튼 (모니터링): 값을 크게, 라벨을 아래 작게
    const valueY = hasSub ? 32 : hasLabel ? 36 : 42
    parts.push(fitText(spec.value, 36, valueY, hasSub ? 20 : 22, fg, 600))
    if (hasLabel) parts.push(fitText(spec.label!, 36, hasSub ? 48 : 55, 11, COLORS.muted))
    if (hasSub) parts.push(fitText(spec.sub!, 36, 60, 9, COLORS.muted))
  } else if (spec.icon) {
    // 아이콘 + 라벨
    const iconY = hasLabel ? 12 : 22
    parts.push(icon(spec.icon, 36, iconY, 28, fg))
    if (hasLabel) parts.push(fitText(spec.label!, 36, hasSub ? 54 : 58, 12, fg))
    if (hasSub) parts.push(fitText(spec.sub!, 36, 65, 9, COLORS.muted))
  } else if (hasLabel) {
    // 라벨 전용: 버튼 폭에 맞춰 줄바꿈하고, 줄이 많으면 글자를 줄인다
    const { lines, size } = fitLabel(spec.label!, hasSub ? 3 : 4)
    const lineH = size + 3
    const centerY = hasSub ? 32 : 40
    const startY = centerY - ((lines.length - 1) * lineH) / 2 + size / 3
    lines.forEach((l, i) => parts.push(text(l, 36, startY + i * lineH, size, fg, 500)))
    if (hasSub) parts.push(fitText(spec.sub!, 36, 64, 9, COLORS.muted))
  }

  if (spec.gauge !== undefined) {
    const w = Math.max(0, Math.min(1, spec.gauge)) * 56
    parts.push(`<rect x="8" y="63" width="56" height="4" rx="2" fill="#2a2d3a"/>`)
    if (w > 0) parts.push(`<rect x="8" y="63" width="${w.toFixed(1)}" height="4" rx="2" fill="${spec.accent ?? COLORS.blue}"/>`)
  }

  if (spec.busy) {
    // 명령 응답을 기다리는 동안 우상단에 점 3개. 흰 화면 대신 이걸 보여준다.
    for (let i = 0; i < 3; i++) {
      parts.push(`<circle cx="${52 + i * 7}" cy="10" r="2" fill="${COLORS.amber}"/>`)
    }
  }

  return `<svg width="72" height="72" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`
}

/** 한 줄에 들어가도록 글자 크기를 줄인다. 최소 크기로도 넘치면 말줄임. */
function fitOneLine(s: string, maxSize: number): { text: string; size: number } {
  for (let size = maxSize; size >= 8; size -= 1) {
    if (textWidth(s, size) <= TEXT_WIDTH) return { text: s, size }
  }
  let cut = s
  while (cut.length > 1 && textWidth(cut + '…', 8) > TEXT_WIDTH) cut = cut.slice(0, -1)
  return { text: cut + '…', size: 8 }
}

/** 폭을 넘지 않도록 자동 축소해서 한 줄로 그린다 */
function fitText(s: string, x: number, y: number, maxSize: number, fill: string, weight = 400): string {
  const { text: t, size } = fitOneLine(s, maxSize)
  return text(t, x, y, size, fill, weight)
}

function text(s: string, x: number, y: number, size: number, fill: string, weight = 400): string {
  return `<text x="${x}" y="${y}" font-family="Apple SD Gothic Neo, Helvetica Neue, sans-serif" ` +
         `font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle">${esc(s)}</text>`
}

function icon(name: IconName, cx: number, top: number, size: number, fill: string): string {
  const scale = size / 24
  const x = cx - size / 2
  return `<g transform="translate(${x} ${top}) scale(${scale.toFixed(3)})">` +
         `<path d="${ICONS[name]}" fill="${fill}"/></g>`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 버튼 안쪽 가용 폭(px) */
const TEXT_WIDTH = 62

/**
 * 글자 폭을 추정한다. 한글/전각은 폰트 크기와 거의 같고, 영문·숫자는 그 절반 남짓이다.
 * SVG 텍스트를 실측할 수단이 없어 근사치를 쓴다.
 */
function textWidth(s: string, size: number): number {
  let w = 0
  for (const ch of s) {
    const code = ch.codePointAt(0)!
    if (code > 0x1100) w += size          // 한글·전각
    else if (ch === ' ') w += size * 0.28
    else w += size * 0.56                 // 영문·숫자
  }
  return w
}

/** 주어진 크기에서 폭에 맞게 줄바꿈한다 (공백 우선, 없으면 글자 단위). */
function wrapAt(s: string, size: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of s.split(' ')) {
    const candidate = line ? `${line} ${word}` : word
    if (textWidth(candidate, size) <= TEXT_WIDTH) { line = candidate; continue }
    if (line) lines.push(line)
    // 단어 자체가 한 줄보다 길면 글자 단위로 자른다
    line = ''
    for (const ch of word) {
      if (textWidth(line + ch, size) > TEXT_WIDTH) { lines.push(line); line = ch }
      else line += ch
    }
  }
  if (line) lines.push(line)
  return lines
}

/** 최대 줄 수 안에 들어가는 가장 큰 글자 크기를 찾는다. */
function fitLabel(s: string, maxLines: number): { lines: string[]; size: number } {
  for (const size of [16, 14, 12, 10, 9]) {
    const lines = wrapAt(s, size)
    if (lines.length <= maxLines) return { lines, size }
  }
  const lines = wrapAt(s, 9).slice(0, maxLines)
  const last = lines.length - 1
  if (last >= 0) lines[last] = lines[last]!.slice(0, -1) + '…'
  return { lines, size: 9 }
}

function lighten(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => Math.min(255, Math.round(v + 45)))
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}
