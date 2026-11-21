import { useEffect, useState } from 'react'
import { endingCopy } from '../content/scenes'
import type { PlaybackRate, RestorationSource } from '../types'
import { PhoneChrome } from './PhoneChrome'
import { SoundTextCanvas } from './SoundTextCanvas'

interface EndingSceneProps {
  timer: string
  audioLevel: number
  audioMuted: boolean
  audioPaused: boolean
  subtitleVisible: boolean
  reducedMotion: boolean
  playbackRate: PlaybackRate
  ambientVolume: number
  voiceVolume: number
  restoredTermSources: Record<string, RestorationSource>
  onToggleAudio: () => void
  onTogglePause: () => void
  onToggleSubtitles: () => void
  onSetPlaybackRate: (rate: PlaybackRate) => void
  onSetAmbientVolume: (volume: number) => void
  onSetVoiceVolume: (volume: number) => void
  onOpenAbout: () => void
  onComplete: () => void
}

export function EndingScene({
  timer,
  audioLevel,
  audioMuted,
  audioPaused,
  subtitleVisible,
  reducedMotion,
  playbackRate,
  ambientVolume,
  voiceVolume,
  restoredTermSources,
  onToggleAudio,
  onTogglePause,
  onToggleSubtitles,
  onSetPlaybackRate,
  onSetAmbientVolume,
  onSetVoiceVolume,
  onOpenAbout,
  onComplete,
}: EndingSceneProps) {
  const [actionReady, setActionReady] = useState(false)
  const restorationSources = Object.values(restoredTermSources)
  const restorationSource: RestorationSource | undefined =
    restorationSources.includes('voice')
      ? 'voice'
      : restorationSources.includes('rhythm')
        ? 'rhythm'
        : undefined
  const restoration =
    restorationSource === 'voice' ? 0.22 : restorationSource === 'rhythm' ? 0.14 : 0.06

  useEffect(() => {
    const timerId = window.setTimeout(
      () => setActionReady(true),
      reducedMotion ? 1200 : 6800,
    )
    return () => window.clearTimeout(timerId)
  }, [reducedMotion])

  return (
    <main className="ending-scene">
      <PhoneChrome
        timer={timer}
        stage="电话"
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

      <section className="ending-field">
        <h1 className="ending-title">{endingCopy.title}</h1>
        <p className="ending-lead ending-fade">{endingCopy.lead}</p>
        <div className="ending-fragment-field ending-fade" aria-hidden="true">
          <SoundTextCanvas
            text={endingCopy.echo}
            stateKey="ending-fragments"
            replayToken={0}
            audioLevel={audioLevel}
            restoration={restoration}
            restored={restorationSource !== undefined}
            restorationSource={restorationSource}
            fragmentBias={0}
            reducedMotion={reducedMotion}
            speaking={false}
            chapter="ending"
            fractureMode="timed"
            layoutMode="horizontal"
            labelPrefix="电话没有挂断"
          />
        </div>
        <p className="ending-small">{endingCopy.afterword}</p>
      </section>

      <footer className="ending-footer">
        {actionReady && (
          <button
            type="button"
            className="quiet-button ending-about-entry"
            onClick={onComplete}
          >
            {endingCopy.action}
          </button>
        )}
      </footer>
    </main>
  )
}
