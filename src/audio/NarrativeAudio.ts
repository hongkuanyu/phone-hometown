import { GLASS_TIMING } from '../config/glassTiming'
import type { AmbientMode, AudioPlaybackResult, StoryTerm } from '../types'

type AudioContextConstructor = typeof AudioContext

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * Web Audio soundscape for generated ambience plus delivered family recordings.
 * Recorded main lines and supplemental explanations take priority over the
 * browser speech-synthesis fallback.
 */
export class NarrativeAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private analyserData = new Uint8Array(512)
  private smoothedLevel = 0
  private lastLevelAt = 0
  private ambientGain: GainNode | null = null
  private ambientSources: AudioScheduledSourceNode[] = []
  private ambientTimers: number[] = []
  private ambientBaseGain = 0.5
  private ambientVolume = 0.58
  private ambientDucked = false
  private voiceGain: GainNode | null = null
  private activeVoiceSources: AudioScheduledSourceNode[] = []
  private voiceVolume = 0.9
  private noiseBuffer: AudioBuffer | null = null
  private muted = false
  private paused = false
  private hidden = false
  private voiceToken = 0
  private currentUtterance: SpeechSynthesisUtterance | null = null

  get supported() {
    return Boolean(
      window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: AudioContextConstructor })
          .webkitAudioContext,
    )
  }

  get isMuted() {
    return this.muted
  }

  get isPaused() {
    return this.paused
  }

  async unlock(): Promise<boolean> {
    if (!this.supported) return false
    const context = this.ensureContext()
    if (context.state === 'suspended' && !this.paused && !this.hidden) {
      try {
        await context.resume()
      } catch {
        return false
      }
    }
    return context.state === 'running'
  }

  private ensureContext() {
    if (this.context) return this.context

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext: AudioContextConstructor })
        .webkitAudioContext
    const context = new AudioContextClass()
    const master = context.createGain()
    const analyser = context.createAnalyser()
    const voiceGain = context.createGain()

    master.gain.value = this.muted ? 0 : 0.72
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.08
    voiceGain.gain.value = this.voiceVolume

    voiceGain.connect(master)
    master.connect(analyser)
    analyser.connect(context.destination)

    this.context = context
    this.master = master
    this.analyser = analyser
    this.voiceGain = voiceGain
    this.analyserData = new Uint8Array(analyser.fftSize)
    this.noiseBuffer = this.createNoiseBuffer(context)
    return context
  }

  private createNoiseBuffer(context: AudioContext) {
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate)
    const channel = buffer.getChannelData(0)
    let last = 0
    for (let index = 0; index < channel.length; index += 1) {
      const white = Math.random() * 2 - 1
      last = (last + 0.018 * white) / 1.018
      channel[index] = last * 2.8
    }
    return buffer
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(
        muted ? 0 : 0.72,
        this.context.currentTime,
        0.05,
      )
    }
    if (muted) this.stopVoice()
  }

  setVoiceVolume(value: number) {
    this.voiceVolume = clamp(value, 0, 1)
    if (this.voiceGain && this.context) {
      this.voiceGain.gain.setTargetAtTime(
        this.voiceVolume,
        this.context.currentTime,
        0.08,
      )
    }
    if (this.currentUtterance) {
      this.currentUtterance.volume = clamp(this.voiceVolume * 0.82, 0, 1)
    }
  }

  setAmbientVolume(value: number) {
    this.ambientVolume = clamp(value, 0, 1)
    this.updateAmbientGain(0.08)
  }

  setAmbientDucked(ducked: boolean) {
    this.ambientDucked = ducked
    this.updateAmbientGain(0.18)
  }

  private updateAmbientGain(timeConstant = 0.18) {
    if (!this.context || !this.ambientGain) return
    const target =
      this.ambientBaseGain * this.ambientVolume * (this.ambientDucked ? 0.3 : 1)
    this.ambientGain.gain.setTargetAtTime(
      target,
      this.context.currentTime,
      timeConstant,
    )
  }

  getLevel() {
    if (!this.analyser) return 0
    this.analyser.getByteTimeDomainData(this.analyserData)
    let sum = 0
    for (const sample of this.analyserData) {
      const normalized = (sample - 128) / 128
      sum += normalized * normalized
    }
    const target = Math.sqrt(sum / this.analyserData.length)
    const now = performance.now()
    const deltaSeconds = clamp(
      this.lastLevelAt ? (now - this.lastLevelAt) / 1000 : 0.045,
      0.016,
      0.12,
    )
    const timeConstant =
      target > this.smoothedLevel
        ? GLASS_TIMING.onset.attackSeconds
        : GLASS_TIMING.onset.releaseSeconds
    const blend = 1 - Math.exp(-deltaSeconds / timeConstant)
    this.smoothedLevel += (target - this.smoothedLevel) * blend
    this.lastLevelAt = now
    return clamp(this.smoothedLevel * 3.2, 0, 1)
  }

  setAmbient(mode: AmbientMode, source?: string) {
    if (!this.context || !this.master) return
    this.stopAmbient()
    if (mode === 'none') return

    const context = this.context
    const gain = context.createGain()
    gain.gain.value = 0
    gain.connect(this.master)
    this.ambientGain = gain
    this.ambientBaseGain =
      mode === 'phone' ? 0.44 : mode === 'kitchen' ? 0.56 : 0.46

    if (source) {
      void this.loadAmbientBuffer(source, gain).catch(() => {
        if (this.ambientGain === gain) this.buildGeneratedAmbient(mode, gain)
      })
    } else {
      this.buildGeneratedAmbient(mode, gain)
    }

    this.updateAmbientGain(0.55)
  }

  private async loadAmbientBuffer(source: string, destination: GainNode) {
    const context = this.ensureContext()
    const response = await fetch(new URL(source, document.baseURI))
    if (!response.ok) throw new Error(`Ambient audio ${response.status}`)
    const buffer = await context.decodeAudioData(await response.arrayBuffer())
    const bufferSource = context.createBufferSource()
    bufferSource.buffer = buffer
    bufferSource.loop = true
    bufferSource.connect(destination)
    bufferSource.start()
    this.ambientSources.push(bufferSource)
  }
  private buildGeneratedAmbient(
    mode: Exclude<AmbientMode, 'none'>,
    gain: GainNode,
  ) {
    const context = this.ensureContext()
    if (!this.noiseBuffer) return

    const noise = context.createBufferSource()
    noise.buffer = this.noiseBuffer
    noise.loop = true

    const filter = context.createBiquadFilter()
    const texture = context.createGain()

    if (mode === 'phone') {
      filter.type = 'lowpass'
      filter.frequency.value = 760
      texture.gain.value = 0.05
    } else if (mode === 'kitchen') {
      filter.type = 'bandpass'
      filter.frequency.value = 1080
      filter.Q.value = 0.55
      texture.gain.value = 0.072
    } else {
      filter.type = 'highpass'
      filter.frequency.value = 1450
      texture.gain.value = 0.032
    }

    noise.connect(filter)
    filter.connect(texture)
    texture.connect(gain)
    noise.start()
    this.ambientSources.push(noise)

    const hum = context.createOscillator()
    const humGain = context.createGain()
    hum.type = 'sine'
    hum.frequency.value = mode === 'phone' ? 62 : mode === 'kitchen' ? 46 : 82
    humGain.gain.value = mode === 'phone' ? 0.012 : 0.006
    hum.connect(humGain)
    humGain.connect(gain)
    hum.start()
    this.ambientSources.push(hum)

    if (mode === 'kitchen') {
      const crackleTimer = window.setInterval(() => {
        if (this.muted || this.paused || this.hidden || !this.context) return
        this.scheduleCrackle(gain)
      }, 760)
      const waterTimer = window.setInterval(() => {
        if (this.muted || this.paused || this.hidden || !this.context) return
        this.scheduleWaterPulse(gain)
      }, 2300)
      this.ambientTimers.push(crackleTimer, waterTimer)
    }

    if (mode === 'night') {
      const chirpTimer = window.setInterval(() => {
        if (this.muted || this.paused || this.hidden || !this.context) return
        this.scheduleChirp(gain)
      }, 1300)
      const fanTimer = window.setInterval(() => {
        if (this.muted || this.paused || this.hidden || !this.context) return
        this.scheduleFanTick(gain)
      }, 2100)
      this.ambientTimers.push(chirpTimer, fanTimer)
    }
  }

  private scheduleCrackle(destination: GainNode) {
    const context = this.ensureContext()
    if (!this.noiseBuffer || this.muted) return
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    const now = context.currentTime
    source.buffer = this.noiseBuffer
    filter.type = 'highpass'
    filter.frequency.value = 1900 + Math.random() * 900
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.032 + Math.random() * 0.025, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(destination)
    source.start(now, Math.random() * 2)
    source.stop(now + 0.1)
  }

  private scheduleWaterPulse(destination: GainNode) {
    const context = this.ensureContext()
    if (this.muted) return
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(180 + Math.random() * 60, now)
    oscillator.frequency.exponentialRampToValueAtTime(90, now + 0.28)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.008, now + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32)
    oscillator.connect(gain)
    gain.connect(destination)
    oscillator.start(now)
    oscillator.stop(now + 0.34)
  }

  private scheduleFanTick(destination: GainNode) {
    const context = this.ensureContext()
    if (this.muted) return
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'triangle'
    oscillator.frequency.value = 210
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.0035, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)
    oscillator.connect(gain)
    gain.connect(destination)
    oscillator.start(now)
    oscillator.stop(now + 0.17)
  }

  private scheduleChirp(destination: GainNode) {
    const context = this.ensureContext()
    if (this.muted) return
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(3100, now)
    oscillator.frequency.exponentialRampToValueAtTime(3900, now + 0.08)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
    oscillator.connect(gain)
    gain.connect(destination)
    oscillator.start(now)
    oscillator.stop(now + 0.18)
  }

  stopAmbient() {
    if (!this.context) return
    const now = this.context.currentTime
    if (this.ambientGain) {
      this.ambientGain.gain.cancelScheduledValues(now)
      this.ambientGain.gain.setTargetAtTime(0, now, 0.25)
    }
    this.ambientTimers.forEach((timer) => window.clearInterval(timer))
    this.ambientTimers = []
    const sources = this.ambientSources
    this.ambientSources = []
    window.setTimeout(() => {
      sources.forEach((source) => {
        try {
          source.stop()
        } catch {
          // Already stopped.
        }
      })
    }, 900)
    this.ambientGain = null
  }
  async playTerm(term: StoryTerm, rate = 1): Promise<AudioPlaybackResult> {
    if (!this.context || this.muted || this.paused || this.hidden) {
      return { kind: 'placeholder', durationMs: 0 }
    }
    this.stopVoice()
    const token = this.voiceToken

    if (term.audioSrc) {
      try {
        const duration = await this.playAudioSource(term.audioSrc, rate, token)
        return {
          kind: 'recording',
          durationMs: (duration / Math.max(0.1, rate)) * 1000,
        }
      } catch (error) {
        console.warn('Local term audio failed; using generated placeholder.', error)
      }
    }

    this.playBreathPulse(term.spokenText, rate)
    this.speakPlaceholder(term.spokenText, rate * 0.95)
    return { kind: 'placeholder', durationMs: 0 }
  }

  async playSupplement(term: StoryTerm, rate = 1): Promise<AudioPlaybackResult> {
    if (!this.context || this.muted || this.paused || this.hidden) {
      return { kind: 'placeholder', durationMs: 0 }
    }
    this.stopVoice()
    const token = this.voiceToken

    if (term.supplementAudioSrc) {
      try {
        const duration = await this.playAudioSource(
          term.supplementAudioSrc,
          rate,
          token,
        )
        return {
          kind: 'recording',
          durationMs: (duration / Math.max(0.1, rate)) * 1000,
        }
      } catch (error) {
        console.warn(
          'Local supplement audio failed; using generated placeholder.',
          error,
        )
      }
    }

    this.playBreathPulse(term.supplement, rate, 0.24)
    this.speakPlaceholder(term.supplement, rate, 0.52)
    return { kind: 'placeholder', durationMs: 0 }
  }

  private async playAudioSource(source: string, rate: number, token: number) {
    const context = this.ensureContext()
    const response = await fetch(new URL(source, document.baseURI))
    if (!response.ok) throw new Error(`Term audio ${response.status}`)
    const buffer = await context.decodeAudioData(await response.arrayBuffer())
    if (token !== this.voiceToken) return 0

    const sourceNode = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    sourceNode.buffer = buffer
    sourceNode.playbackRate.value = rate
    filter.type = 'lowpass'
    filter.frequency.value = 9000
    gain.gain.value = 0.95
    sourceNode.connect(filter)
    filter.connect(gain)
    gain.connect(this.voiceGain!)
    sourceNode.start()
    this.activeVoiceSources.push(sourceNode)
    sourceNode.onended = () => {
      this.activeVoiceSources = this.activeVoiceSources.filter((node) => node !== sourceNode)
    }
    return buffer.duration
  }

  private playBreathPulse(text: string, rate: number, volume = 0.58) {
    const context = this.ensureContext()
    if (!this.voiceGain) return
    const duration = clamp(text.length * 0.17, 4.2, 8.8) / Math.max(0.7, rate)
    const syllables = Math.max(6, Math.min(24, Array.from(text).length))
    const start = context.currentTime + 0.04
    const step = duration / syllables

    for (let index = 0; index < syllables; index += 1) {
      const oscillator = context.createOscillator()
      const formant = context.createBiquadFilter()
      const gain = context.createGain()
      const pulseStart = start + index * step
      const pulseLength = Math.min(step * 0.78, 0.3)
      const frequency = 138 + Math.sin(index * 1.73) * 18 + Math.random() * 9

      oscillator.type = 'sawtooth'
      oscillator.frequency.setValueAtTime(frequency, pulseStart)
      oscillator.frequency.linearRampToValueAtTime(
        frequency * (0.94 + Math.random() * 0.1),
        pulseStart + pulseLength,
      )
      formant.type = 'bandpass'
      formant.frequency.value = 650 + Math.random() * 450
      formant.Q.value = 1.5
      gain.gain.setValueAtTime(0.0001, pulseStart)
      gain.gain.exponentialRampToValueAtTime(
        volume * (0.024 + Math.random() * 0.02),
        pulseStart + 0.035,
      )
      gain.gain.exponentialRampToValueAtTime(0.0001, pulseStart + pulseLength)
      oscillator.connect(formant)
      formant.connect(gain)
      gain.connect(this.voiceGain)
      oscillator.start(pulseStart)
      oscillator.stop(pulseStart + pulseLength + 0.03)
      this.activeVoiceSources.push(oscillator)
      oscillator.onended = () => {
        this.activeVoiceSources = this.activeVoiceSources.filter((node) => node !== oscillator)
      }
    }
  }

  private speakPlaceholder(text: string, rate: number, volume = 0.72) {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const voices = window.speechSynthesis.getVoices()
    const chineseVoice = voices.find((voice) =>
      /^(zh|cmn)|chinese|xiaoxiao|huihui|tingting|meijia/i.test(
        `${voice.lang} ${voice.name}`,
      ),
    )
    if (chineseVoice) utterance.voice = chineseVoice
    utterance.lang = 'zh-CN'
    utterance.rate = clamp(rate, 0.65, 1.15)
    utterance.pitch = 0.82
    utterance.volume = clamp(this.voiceVolume * volume, 0, 1)
    this.currentUtterance = utterance
    utterance.onend = () => {
      if (this.currentUtterance === utterance) this.currentUtterance = null
    }
    window.speechSynthesis.speak(utterance)
  }

  stopVoice() {
    this.voiceToken += 1
    this.activeVoiceSources.forEach((source) => {
      try {
        source.stop()
      } catch {
        // The source may already have ended.
      }
    })
    this.activeVoiceSources = []
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    this.currentUtterance = null
    if (this.voiceGain && this.context) {
      const now = this.context.currentTime
      this.voiceGain.gain.cancelScheduledValues(now)
      this.voiceGain.gain.setTargetAtTime(0, now, 0.025)
      this.voiceGain.gain.setTargetAtTime(
        this.voiceVolume,
        now + 0.15,
        0.04,
      )
    }
  }

  setPaused(paused: boolean) {
    this.paused = paused
    if ('speechSynthesis' in window) {
      if (paused) window.speechSynthesis.pause()
      else if (!this.hidden) window.speechSynthesis.resume()
    }
    this.syncContextState()
  }

  pauseForVisibility(hidden: boolean) {
    this.hidden = hidden
    if ('speechSynthesis' in window) {
      if (hidden) window.speechSynthesis.pause()
      else if (!this.paused) window.speechSynthesis.resume()
    }
    this.syncContextState()
  }

  private syncContextState() {
    if (!this.context) return
    if ((this.paused || this.hidden) && this.context.state === 'running') {
      void this.context.suspend()
    } else if (
      !this.paused &&
      !this.hidden &&
      this.context.state === 'suspended'
    ) {
      void this.context.resume()
    }
  }

  async close() {
    this.stopVoice()
    this.stopAmbient()
    if (this.context) await this.context.close()
    this.context = null
  }
}