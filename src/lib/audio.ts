// 오디오 매니저 — BGM 루프 + SFX(클릭/피격/처치) 재생을 한 곳에서 관리한다.
// Web Audio API 기반: AudioContext 하나에 bgmGain/sfxGain을 두고, 재생마다
// 새 AudioBufferSourceNode를 만들어 겹쳐 재생한다(<audio> 엘리먼트 여러 개를
// 매번 새로 만드는 것보다 가볍고, 피치 랜덤화도 playbackRate로 바로 된다).
//
// 방치형 특성상 전투 중 피격/처치음이 초당 여러 번 겹쳐 울릴 수 있어(요청
// "반복 거슬림 방지") 종류별로 동시 재생 수 제한과 최소 재생 간격(쿨다운)을 둔다.

export type SfxKey = 'click' | 'hit' | 'kill'

const SFX_URLS: Record<SfxKey, string> = {
  click: '/audio/sfx-click.ogg',
  hit: '/audio/sfx-hit.ogg',
  kill: '/audio/sfx-kill.ogg',
}
const BGM_URL = '/audio/bgm.mp3'

const STORAGE_KEY = 'idle-rpg:audio-settings'

export interface AudioSettings {
  bgmVolume: number // 0~1
  sfxVolume: number // 0~1
  muted: boolean
}

// 기본값: BGM 낮게, SFX 중간, 음소거 해제(요청 5번 "기본값" 그대로).
const DEFAULT_SETTINGS: AudioSettings = {
  bgmVolume: 0.15,
  sfxVolume: 0.5,
  muted: false,
}

// 종류별 동시 재생 수 제한 — 피격/처치는 전투 중 빠르게 겹칠 수 있어 3개로
// 제한(그 이상은 이미 뭉개져 들려 늘려도 체감이 없다). 클릭은 UI 조작이라
// 원래도 빠르게 겹칠 일이 거의 없지만 연타 대비 4개.
const SFX_MAX_CONCURRENT: Record<SfxKey, number> = { click: 4, hit: 3, kill: 3 }
// 종류별 최소 재생 간격(ms) — 이 안에 같은 종류가 다시 재생 요청되면 건너뛴다.
const SFX_COOLDOWN_MS: Record<SfxKey, number> = { click: 20, hit: 30, kill: 50 }
// 피격/처치음 피치 랜덤화 범위(±10%) — 클릭음은 UI 피드백이라 일관된 소리가
// 낫다고 판단해 랜덤화하지 않는다.
const PITCH_RANDOM_KEYS: SfxKey[] = ['hit', 'kill']
const PITCH_RANDOM_RANGE = 0.1

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AudioSettings>
    return {
      bgmVolume: typeof parsed.bgmVolume === 'number' ? parsed.bgmVolume : DEFAULT_SETTINGS.bgmVolume,
      sfxVolume: typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : DEFAULT_SETTINGS.sfxVolume,
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SETTINGS.muted,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings: AudioSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // 저장 실패(프라이빗 모드 등)해도 이번 세션 재생 자체는 계속돼야 하므로 무시.
  }
}

type SettingsListener = (settings: AudioSettings) => void

class AudioManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private bgmGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  private bgmSource: AudioBufferSourceNode | null = null
  private settings: AudioSettings = loadSettings()
  private unlocked = false
  private preloadPromise: Promise<void> | null = null
  private activeCounts: Record<SfxKey, number> = { click: 0, hit: 0, kill: 0 }
  private lastPlayedAt: Record<SfxKey, number> = { click: 0, hit: 0, kill: 0 }
  private listeners = new Set<SettingsListener>()

  getSettings(): AudioSettings {
    return { ...this.settings }
  }

  onSettingsChange(listener: SettingsListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emitSettings(): void {
    for (const listener of this.listeners) listener(this.getSettings())
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx
    if (typeof window === 'undefined') return null
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    try {
      const ctx = new Ctor()
      const masterGain = ctx.createGain()
      masterGain.connect(ctx.destination)
      const bgmGain = ctx.createGain()
      bgmGain.connect(masterGain)
      const sfxGain = ctx.createGain()
      sfxGain.connect(masterGain)
      this.ctx = ctx
      this.masterGain = masterGain
      this.bgmGain = bgmGain
      this.sfxGain = sfxGain
      this.applyVolumes()
      return ctx
    } catch (error) {
      console.error('[audio] AudioContext 생성 실패 — 오디오 없이 진행합니다.', error)
      return null
    }
  }

  private applyVolumes(): void {
    if (!this.masterGain || !this.bgmGain || !this.sfxGain) return
    this.masterGain.gain.value = this.settings.muted ? 0 : 1
    this.bgmGain.gain.value = this.settings.bgmVolume
    this.sfxGain.gain.value = this.settings.sfxVolume
  }

  // 프리로드 — 로딩 화면 단계에서 미리 호출해 첫 재생 지연을 없앤다(요청 4번).
  // decodeAudioData에 AudioContext가 필요하긴 하지만, 디코딩 자체는 소리를 내지
  // 않으므로 사용자 제스처 없이 호출해도 브라우저 자동재생 정책에 걸리지 않는다.
  preload(): Promise<void> {
    if (this.preloadPromise) return this.preloadPromise
    this.preloadPromise = (async () => {
      const ctx = this.ensureContext()
      if (!ctx) return
      const entries = Object.entries({ ...SFX_URLS, bgm: BGM_URL })
      await Promise.all(
        entries.map(async ([key, url]) => {
          try {
            const res = await fetch(url)
            const arrayBuffer = await res.arrayBuffer()
            const buffer = await ctx.decodeAudioData(arrayBuffer)
            this.buffers.set(key, buffer)
          } catch (error) {
            console.error(`[audio] ${key} 프리로드 실패`, error)
          }
        }),
      )
    })()
    return this.preloadPromise
  }

  // 브라우저 자동재생 정책 대응 — 첫 사용자 상호작용(클릭/터치/키 입력) 핸들러
  // 안에서 호출해야 한다(요청 4번). AudioContext.resume()은 사용자 제스처
  // 콜스택 안에서 호출될 때만 허용된다.
  async unlock(): Promise<void> {
    if (this.unlocked) return
    this.unlocked = true
    const ctx = this.ensureContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch (error) {
        console.error('[audio] AudioContext resume 실패', error)
      }
    }
    await this.preload()
    this.startBgm()
  }

  private startBgm(): void {
    if (!this.ctx || !this.bgmGain) return
    if (this.ctx.state !== 'running') return
    if (this.bgmSource) return // 이미 재생 중
    const buffer = this.buffers.get('bgm')
    if (!buffer) return
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(this.bgmGain)
    source.start()
    this.bgmSource = source
  }

  // 탭이 백그라운드로 갈 때/돌아올 때 — AudioContext 전체를 suspend/resume한다
  // (요청 4번 "백그라운드일 때 BGM 일시정지 검토"). 개별 소스를 멈췄다 이어
  // 재생하는 것보다 훨씬 간단하고, 어차피 탭이 안 보이는 동안은 SFX도 들릴
  // 필요가 없다.
  suspendForBackground(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }

  resumeFromBackground(): void {
    if (this.ctx && this.ctx.state === 'suspended' && this.unlocked) void this.ctx.resume()
  }

  playSfx(key: SfxKey): void {
    if (this.settings.muted) return
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running') return

    const now = performance.now()
    if (now - this.lastPlayedAt[key] < SFX_COOLDOWN_MS[key]) return
    if (this.activeCounts[key] >= SFX_MAX_CONCURRENT[key]) return

    const buffer = this.buffers.get(key)
    if (!buffer) return

    this.lastPlayedAt[key] = now
    this.activeCounts[key] += 1

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    if (PITCH_RANDOM_KEYS.includes(key)) {
      source.playbackRate.value = 1 + (Math.random() * 2 - 1) * PITCH_RANDOM_RANGE
    }
    source.connect(this.sfxGain)
    source.onended = () => {
      this.activeCounts[key] = Math.max(0, this.activeCounts[key] - 1)
    }
    source.start()
  }

  setBgmVolume(volume: number): void {
    this.settings.bgmVolume = Math.min(1, Math.max(0, volume))
    this.applyVolumes()
    saveSettings(this.settings)
    this.emitSettings()
  }

  setSfxVolume(volume: number): void {
    this.settings.sfxVolume = Math.min(1, Math.max(0, volume))
    this.applyVolumes()
    saveSettings(this.settings)
    this.emitSettings()
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted
    this.applyVolumes()
    saveSettings(this.settings)
    this.emitSettings()
  }
}

export const audioManager = new AudioManager()

// 로딩 화면 단계에서 한 번 호출 — 첫 재생 지연 방지(요청 4번).
export function preloadAudio(): void {
  void audioManager.preload()
}

// App 최상위에서 한 번만 등록 — 첫 클릭/터치/키 입력에 오디오 컨텍스트를 풀고
// BGM을 시작한다(요청 4번, 자동재생 정책 대응). 이후 탭 가시성 변화에 맞춰
// AudioContext를 suspend/resume한다(요청 4번, 백그라운드 일시정지).
export function initAudioUnlock(): void {
  if (typeof window === 'undefined') return
  const unlock = () => {
    void audioManager.unlock()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audioManager.suspendForBackground()
    else audioManager.resumeFromBackground()
  })
}

// 버튼 클릭 SFX — 모든 <button>을 개별적으로 수정하는 대신 document 레벨에서
// 한 번만 위임 등록한다(현재 18개 파일이 각자 raw <button>을 쓰고 있어 공용
// Button 컴포넌트 하나로 묶여 있지 않다 — 여기서 델리게이션하면 그 구조를
// 바꾸지 않고도 전부 커버된다).
export function initClickSfx(): void {
  if (typeof window === 'undefined') return
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target
      if (target instanceof Element && target.closest('button')) {
        audioManager.playSfx('click')
      }
    },
    { capture: true },
  )
}
