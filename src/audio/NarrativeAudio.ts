import type { AmbientMode, StoryTerm } from '../types'

type AudioContextConstructor = typeof AudioContext

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * Small Web Audio soundscape engine.
 * It prefers an authorized local recording when one is configured and otherwise
 * creates a clearly replaceable synthetic voice/ambience placeholder.
 */
export class NarrativeAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private analyserData = new Uint8Array(512)
  private ambientGain: GainNode | null = null
  private ambientSources: AudioScheduledSourceNode[] = []
  private ambientTimers: number[] = []
  private voiceGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private muted = false
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

  async unlock(): Promise<boolean> {
    if (!this.supported) return false
    const context = this.ensureContext()
    if (context.state === 'suspended') {
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
    analyser.smoothingTimeConstant = 0.82
    voiceGain.gain.value = 1

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
        0.04,
      )
    }
    if (muted) {
      this.stopVoice()
    }
  }

  getLevel() {
    if (!this.analyser) return 0
    this.analyser.getByteTimeDomainData(this.analyserData)
    let sum = 0
    for (const sample of this.analyserData) {
      const normalized = (sample - 128) / 128
      sum += normalized * normalized
    }
    return clamp(Math.sqrt(sum / this.analyserData.length) * 3.2, 0, 1)
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

    if (source) {
      void this.loadAmbientBuffer(source, gain).catch(() => {
        if (this.ambientGain === gain) this.buildGeneratedAmbient(mode, gain)
      })
    } else {
      this.buildGeneratedAmbient(mode, gain)
    }

    gain.gain.setTargetAtTime(
      mode === 'phone' ? 0.52 : mode === 'kitchen' ? 0.62 : 0.48,
      context.currentTime,
      0.55,
    )
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

  private buildGeneratedAmbient(mode: Exclude<AmbientMode, 'none'>, gain: GainNode) {
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
      texture.gain.value = 0.055
    } else if (mode === 'kitchen') {
      filter.type = 'bandpass'
      filter.frequency.value = 1100
      filter.Q.value = 0.55
      texture.gain.value = 0.075
    } else {
      filter.type = 'highpass'
      filter.frequency.value = 1500
      texture.gain.value = 0.035
    }

    noise.connect(filter)
    filter.connect(texture)
    texture.connect(gain)
    noise.start()
    this.ambientSources.push(noise)

    const hum = context.createOscillator()
    const humGain = context.createGain()
    hum.type = 'sine'
    hum.frequency.value = mode === 'phone' ? 62 : mode === 'kitchen' ? 47 : 82
    humGain.gain.value = mode === 'phone' ? 0.014 : 0.008
    hum.connect(humGain)
    humGain.connect(gain)
    hum.start()
    this.ambientSources.push(hum)

    if (mode === 'kitchen') {
      const crackleTimer = window.setInterval(() => {
        if (this.muted || document.hidden || !this.context) return
        this.scheduleCrackle(gain)
      }, 720)
      this.ambientTimers.push(crackleTimer)
    }

    if (mode === 'night') {
      const chirpTimer = window.setInterval(() => {
        if (this.muted || document.hidden || !this.context) return
        this.scheduleChirp(gain)
      }, 1280)
      this.ambientTimers.push(chirpTimer)
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
    gain.gain.exponentialRampToValueAtTime(0.035 + Math.random() * 0.03, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(destination)
    source.start(now, Math.random() * 2)
    source.stop(now + 0.1)
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
    gain.gain.exponentialRampToValueAtTime(0.012, now + 0.025)
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

  async playTerm(term: StoryTerm, rate = 1): Promise<'recording' | 'placeholder'> {
    if (!this.context || this.muted) return 'placeholder'
    this.stopVoice()
    const token = this.voiceToken

    if (term.audioSrc) {
      try {
        await this.playAudioSource(term.audioSrc, rate, token)
        return 'recording'
      } catch (error) {
        console.warn('Local term audio failed; using generated placeholder.', error)
      }
    }

    this.playBreathPulse(term.spokenText, rate)
    this.speakPlaceholder(term.spokenText, rate * 0.95)
    return 'placeholder'
  }

  playHint(text: string) {
    if (!this.context || this.muted) return
    this.stopVoice()
    this.playBreathPulse(text, 0.9, 0.22)
    this.speakPlaceholder(text, 0.9, 0.45)
  }

  private async playAudioSource(source: string, rate: number, token: number) {
    const context = this.ensureContext()
    const response = await fetch(new URL(source, document.baseURI))
    if (!response.ok) throw new Error(`Term audio ${response.status}`)
    const buffer = await context.decodeAudioData(await response.arrayBuffer())
    if (token !== this.voiceToken) return

    const sourceNode = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    sourceNode.buffer = buffer
    sourceNode.playbackRate.value = rate
    filter.type = 'lowpass'
    filter.frequency.value = 7200
    gain.gain.value = 0.95
    sourceNode.connect(filter)
    filter.connect(gain)
    gain.connect(this.voiceGain!)
    sourceNode.start()
  }

  private playBreathPulse(text: string, rate: number, volume = 0.55) {
    const context = this.ensureContext()
    if (!this.voiceGain) return
    const duration = clamp(text.length * 0.16, 2.6, 5.2) / Math.max(0.7, rate)
    const syllables = Math.max(4, Math.min(16, Array.from(text).length))
    const start = context.currentTime + 0.04
    const step = duration / syllables

    for (let index = 0; index < syllables; index += 1) {
      const oscillator = context.createOscillator()
      const formant = context.createBiquadFilter()
      const gain = context.createGain()
      const pulseStart = start + index * step
      const pulseLength = Math.min(step * 0.78, 0.28)
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
        volume * (0.025 + Math.random() * 0.022),
        pulseStart + 0.035,
      )
      gain.gain.exponentialRampToValueAtTime(0.0001, pulseStart + pulseLength)
      oscillator.connect(formant)
      formant.connect(gain)
      gain.connect(this.voiceGain)
      oscillator.start(pulseStart)
      oscillator.stop(pulseStart + pulseLength + 0.03)
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
    utterance.volume = clamp(volume, 0, 1)
    this.currentUtterance = utterance
    utterance.onend = () => {
      if (this.currentUtterance === utterance) this.currentUtterance = null
    }
    window.speechSynthesis.speak(utterance)
  }

  stopVoice() {
    this.voiceToken += 1
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    this.currentUtterance = null
    if (this.voiceGain && this.context) {
      const now = this.context.currentTime
      this.voiceGain.gain.cancelScheduledValues(now)
      this.voiceGain.gain.setTargetAtTime(0, now, 0.025)
      this.voiceGain.gain.setTargetAtTime(1, now + 0.15, 0.04)
    }
  }

  pauseForVisibility(hidden: boolean) {
    if ('speechSynthesis' in window) {
      if (hidden) window.speechSynthesis.pause()
      else window.speechSynthesis.resume()
    }
    if (!this.context) return
    if (hidden && this.context.state === 'running') {
      void this.context.suspend()
    } else if (!hidden && this.context.state === 'suspended') {
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