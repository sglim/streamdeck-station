/**
 * 레이아웃을 5x3 합성 PNG로 저장하는 개발용 도구.
 * 헤드리스 환경에서 하드웨어 없이 버튼 디자인을 확인할 때 쓴다.
 */
import sharp, { type OverlayOptions } from 'sharp'
import { renderButton, KEY_SIZE } from '../deck/render.js'
import { SLOTS, type Layout } from '../deck/station.js'

const GAP = 8

export async function savePreview(layout: Layout, outPath: string): Promise<void> {
  const width = 5 * KEY_SIZE + 6 * GAP
  const height = 3 * KEY_SIZE + 4 * GAP
  const composites: OverlayOptions[] = []

  for (let i = 0; i < SLOTS; i++) {
    const spec = layout[i]
    if (!spec) continue
    composites.push({
      input: await renderButton(spec),
      raw: { width: KEY_SIZE, height: KEY_SIZE, channels: 4 },
      left: GAP + (i % 5) * (KEY_SIZE + GAP),
      top: GAP + Math.floor(i / 5) * (KEY_SIZE + GAP),
    })
  }

  await sharp({ create: { width, height, channels: 4, background: '#000000' } })
    .composite(composites)
    .png()
    .toFile(outPath)
}
