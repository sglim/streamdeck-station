/** Home Assistant REST API 클라이언트 (localhost:8123) */

export interface HassState {
  entity_id: string
  state: string
  attributes: Record<string, any>
}

export class Hass {
  private states = new Map<string, HassState>()
  private lastFetch = 0
  private inflight: Promise<void> | null = null

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  /** 토큰이 없으면 HA 기능 전체를 끈다 */
  get enabled(): boolean {
    return this.token.length > 0
  }

  /** 캐시된 상태. maxAgeMs보다 오래됐으면 다시 가져온다. */
  async getStates(maxAgeMs = 2000): Promise<Map<string, HassState>> {
    if (!this.enabled) return this.states
    if (Date.now() - this.lastFetch < maxAgeMs) return this.states
    // 동시 호출이 겹치면 한 번만 요청한다
    this.inflight ??= this.refresh().finally(() => { this.inflight = null })
    await this.inflight
    return this.states
  }

  async get(entityId: string, maxAgeMs = 2000): Promise<HassState | undefined> {
    return (await this.getStates(maxAgeMs)).get(entityId)
  }

  private async refresh(): Promise<void> {
    try {
      const list = (await this.request('GET', '/api/states')) as HassState[]
      this.states = new Map(list.map((s) => [s.entity_id, s]))
      this.lastFetch = Date.now()
    } catch (err) {
      console.error('[hass] 상태 조회 실패:', (err as Error).message)
    }
  }

  /** 서비스 호출 후 상태 캐시를 무효화한다 */
  async call(domain: string, service: string, data: Record<string, any> = {}): Promise<void> {
    if (!this.enabled) return
    await this.request('POST', `/api/services/${domain}/${service}`, data)
    this.lastFetch = 0
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const res = await fetch(this.url + path, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${res.statusText}`)
    return res.status === 204 ? null : res.json()
  }

  // --- 편의 메서드 ---

  async toggle(entityId: string): Promise<void> {
    await this.call(entityId.split('.')[0]!, 'toggle', { entity_id: entityId })
  }

  async activateScene(entityId: string): Promise<void> {
    await this.call('scene', 'turn_on', { entity_id: entityId })
  }

  async mediaCommand(
    entityId: string,
    service: 'media_play_pause' | 'media_next_track' | 'media_previous_track' | 'media_stop' | 'turn_off',
  ): Promise<void> {
    await this.call('media_player', service, { entity_id: entityId })
  }

  async setVolume(entityId: string, level: number): Promise<void> {
    await this.call('media_player', 'volume_set', {
      entity_id: entityId,
      volume_level: Math.max(0, Math.min(1, level)),
    })
  }

  async playUrl(entityId: string, url: string, type = 'music'): Promise<void> {
    await this.call('media_player', 'play_media', {
      entity_id: entityId,
      media_content_id: url,
      media_content_type: type,
    })
  }

  /** 도메인으로 엔티티를 추려낸다 (설정 자동 생성에 쓴다) */
  async entitiesOf(domain: string): Promise<HassState[]> {
    const states = await this.getStates(60_000)
    return [...states.values()].filter((s) => s.entity_id.startsWith(`${domain}.`))
  }
}
