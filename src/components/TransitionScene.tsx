import { useEffect, useState } from 'react'
import { coolingTerms } from '../content/terms'
import type { PlaybackRate } from '../types'
import { PhoneChrome } from './PhoneChrome'
import { SoundTextCanvas } from './SoundTextCanvas'

interface TransitionSceneProps {
  timer: string
  audioLevel: number
  audioMuted: boolean
  audioPaused: boolean
  subtitleVisible: boolean
  reducedMotion: boolean
  playbackRate: PlaybackRate
  ambientVolume: number
  voiceVolume: number
  onToggleAudio: () => void
  onTogglePause: () => void
  onToggleSubtitles: () => void
  onSetPlaybackRate: (rate: PlaybackRate) => void
  onSetAmbientVolume: (volume: number) => void
  onSetVoiceVolume: (volume: number) => void
  onOpenAbout: () => void
  onComplete: () => void
}

export function TransitionScene({
  timer,
  audioLevel,
  audioMuted,
  audioPaused,
  subtitleVisible,
  reducedMotion,
  playbackRate,
  ambientVolume,
  voiceVolume,
  onToggleAudio,
  onTogglePause,
  onToggleSubtitles,
  onSetPlaybackRate,
  onSetAmbientVolume,
  onSetVoiceVolume,
  onOpenAbout,
  onComplete,
}: TransitionSceneProps) {
  const [text, setText] = useState('风过竹榻')

  useEffect(() => {
    if (audioPaused) return
    const textTimer = window.setTimeout(
      () => setText(coolingTerms[0].display),
      1400,
    )
    const finishTimer = window.setTimeout(onComplete, 4000)
    return () => {
      window.clearTimeout(textTimer)
      window.clearTimeout(finishTimer)
    }
  }, [audioPaused, onComplete])

  return (
    <main className="transition-scene">
      <PhoneChrome
        timer={timer}
        stage="转场"
        audioMuted={audioMuted}
        audioPaused={audioPaused}
        subtitleVisible={subtitleVisible}
        playbackRate={playbackRate}
        ambientVolume={ambientVolume}
        voiceVolume={voiceVolume}
        onToggleAudio={onToggleAudio}
        onTogglePause={onTogglePause}
        onToggleSubtitles={onToggleSubtitles}
        onSetPlaybackRate={onSetPlaybackRate}
        onSetAmbientVolume={onSetAmbientVolume}
        onSetVoiceVolume={onSetVoiceVolume}
        onOpenAbout={onOpenAbout}
      />

      <section className="transition-field">
        <p className="transition-caption">
          {audioPaused ? '声音停在这里' : '灶火退远，虫鸣靠近'}
        </p>
        <SoundTextCanvas
          text={text}
          stateKey={text}
          replayToken={0}
          audioLevel={audioLevel}
          restoration={0}
          reducedMotion={reducedMotion}
          speaking={!audioPaused && !audioMuted}
          labelPrefix="转场文字"
        />
        <p className="transition-note">文字被吹散，又在另一个夏夜重新排列。</p>
        <button type="button" className="quiet-button transition-skip" onClick={onComplete}>
          现在进入纳凉
        </button>
      </section>
    </main>
  )
}