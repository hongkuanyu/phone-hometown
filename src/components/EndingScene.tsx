import { useEffect, useState } from 'react'
import { endingCopy } from '../content/scenes'
import { termById } from '../content/terms'
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
  skippedTermIds: string[]
  inspectedTermIds: string[]
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
  skippedTermIds,
  inspectedTermIds,
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
  const restoredTermIds = Object.keys(restoredTermSources)
  const restoredEntries = restoredTermIds.flatMap((id) => {
    const term = termById.get(id)
    return term ? [{ term, source: restoredTermSources[id] }] : []
  })
  const voiceRestoredTerms = restoredEntries.filter(
    ({ source }) => source === 'voice',
  )
  const rhythmRestoredTerms = restoredEntries.filter(
    ({ source }) => source === 'rhythm',
  )
  const semanticRestoredTerms = restoredEntries.filter(
    ({ source }) => source === 'semantic',
  )
  const voiceRestoredCount = voiceRestoredTerms.length
  const rhythmRestoredCount = rhythmRestoredTerms.length
  const endingRestorationSource =
    voiceRestoredCount > 0
      ? 'voice'
      : rhythmRestoredCount > 0
        ? 'rhythm'
        : undefined
  const endingParticipationCopy =
    voiceRestoredCount > 0
      ? endingCopy.followed
      : rhythmRestoredCount > 0
        ? endingCopy.rhythmFollowed
        : semanticRestoredTerms.length > 0
          ? endingCopy.semanticFollowed
          : endingCopy.unparticipated
  const skippedTerms = skippedTermIds
    .map((id) => termById.get(id))
    .filter((term) => term !== undefined)
  const inspectedTerms = inspectedTermIds
    .map((id) => termById.get(id))
    .filter((term) => term !== undefined)

  useEffect(() => {
    const timerId = window.setTimeout(
      () => setActionReady(true),
      reducedMotion ? 500 : 2200,
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
        <p className="ending-lead ending-fade">{endingCopy.lead}</p>
        <h1 className="ending-title">{endingCopy.title}</h1>
        <div className="ending-fragment-field ending-fade" aria-hidden="true">
          <SoundTextCanvas
            text={endingCopy.echo}
            stateKey="ending-fragments"
            replayToken={0}
            audioLevel={audioLevel}
            restoration={
              voiceRestoredCount > 0
                ? 0.22
                : rhythmRestoredCount > 0
                  ? 0.14
                  : 0.08
            }
            restored={endingRestorationSource !== undefined}
            restorationSource={endingRestorationSource}
            fragmentBias={skippedTerms.length > 2 ? 0.18 : 0}
            reducedMotion={reducedMotion}
            speaking={false}
            chapter="ending"
            fractureMode="timed"
            layoutMode="horizontal"
            labelPrefix="结尾周围的声音"
          />
        </div>
        <p className="ending-small">{endingParticipationCopy}</p>

        <div className="ending-traces ending-fade" aria-label="这次体验留下的痕迹">
          {voiceRestoredTerms.length > 0 && (
            <p>
              <span>声音补回过的词</span>
              {voiceRestoredTerms.slice(-4).map(({ term }) => term.display).join(' · ')}
            </p>
          )}
          {rhythmRestoredTerms.length > 0 && (
            <p>
              <span>节奏补回过的词</span>
              {rhythmRestoredTerms.slice(-4).map(({ term }) => term.display).join(' · ')}
            </p>
          )}
          {semanticRestoredTerms.length > 0 && (
            <p>
              <span>看过解释的词</span>
              {semanticRestoredTerms.slice(-4).map(({ term }) => term.display).join(' · ')}
            </p>
          )}
          {skippedTerms.length > 0 && (
            <p className="ending-trace--skipped">
              <span>没有追问的字</span>
              {skippedTerms.slice(-4).map((term) => term?.display).join('  ')}
            </p>
          )}
          {inspectedTerms.length > 0 && (
            <p>
              <span>停留过的上下文</span>
              {inspectedTerms.slice(-2).map((term) => term?.context).join(' / ')}
            </p>
          )}
        </div>
      </section>

      <footer className="ending-footer">
        <p className="ending-fade">她还在和亲戚说话。电话底噪慢慢盖过了解释。</p>
        {actionReady && (
          <button
            type="button"
            className="primary-button primary-button--small"
            onClick={onComplete}
          >
            {endingCopy.action}
          </button>
        )}
      </footer>
    </main>
  )
}