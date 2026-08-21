import type { Config } from '../config.js'
import type { Hass } from '../integrations/hass.js'
import type { Station, Layout } from '../deck/station.js'
import { COLORS, type ButtonSpec, type IconName } from '../deck/render.js'
import { SLOTS } from '../deck/station.js'

export interface AppContext {
  station: Station
  hass: Hass
  config: Config
}

/** 15칸짜리 빈 레이아웃 */
export function emptyLayout(): Layout {
  return Array.from({ length: SLOTS }, () => null)
}

/** 우하단(14번)에 놓는 홈 복귀 버튼 */
export function homeButton(): ButtonSpec {
  return { icon: 'home', label: '홈', bg: '#1b1d28', fg: COLORS.muted }
}

/** 페이지 진입 버튼 */
export function navButton(label: string, icon: IconName, accent: string): ButtonSpec {
  return { icon, label, accent, bg: COLORS.bgAlt }
}

/** 켜짐/꺼짐 상태를 색으로 표현하는 토글 버튼 */
export function toggleButton(
  label: string,
  on: boolean,
  icon: IconName,
  onColor = COLORS.amber,
): ButtonSpec {
  return {
    icon,
    label,
    fg: on ? onColor : COLORS.muted,
    bg: on ? '#2a2415' : COLORS.bg,
    accent: on ? onColor : undefined,
  }
}
