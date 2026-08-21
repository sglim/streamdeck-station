import type { Config } from '../config.js'
import type { Hass, HassState } from '../integrations/hass.js'
import { peekNowPlaying, refreshNowPlaying } from '../integrations/icy.js'
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

export interface Track {
  title?: string
  artist?: string
}

/**
 * 재생 중인 곡을 알아낸다. HA가 주는 메타데이터를 먼저 쓰고,
 * 비어 있으면 스트림의 ICY 정보를 본다 (Cast 리시버가 곡 정보를 넘기지 않는다).
 * 홈 화면과 음악 페이지가 같이 쓴다.
 */
export function resolveTrack(state: HassState | undefined): Track {
  if (state?.state !== 'playing') return {}

  const title = state.attributes.media_title as string | undefined
  const artist = (state.attributes.media_artist ?? state.attributes.media_channel) as string | undefined
  if (title) return { title, artist }

  const url = state.attributes.media_content_id as string | undefined
  if (!url?.startsWith('http')) return {}
  refreshNowPlaying(url)
  const icy = peekNowPlaying(url)
  return { title: icy?.title, artist: icy?.artist }
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
