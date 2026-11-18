import { endingCopy } from '../content/scenes'
import { termById } from '../content/terms'
import type { PlaybackRate } from '../types'
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
  restoredTermIds: string[]
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
  restoredTermIds,
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
  const restoredTerms = restoredTermIds
    .map((id) => termById.get(id))
    .filter((term) => term !== undefined)
  const skippedTerms = skippedTermIds
    .map((id) => termById.get(id))
    .filter((term) => term !== undefined)
  const inspectedTerms = inspectedTermIds
    .map((id) => termById.get(id))
    .filter((term) => term !== undefined)
  const restoration = Math.max(
    0.1,
    Math.min(
      0.58,
      0.2 +
        restoredTerms.length * 0.075 +
        inspectedTerms.length * 0.025 -
        skippedTerms.length * 0.035,
    ),
  )

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
        <p className="ending-lead">{endingCopy.lead}</p>
        <SoundTextCanvas
          text={endingCopy.title}
          stateKey="ending"
          replayToken={0}
          audioLevel={audioLevel}
          restoration={restoration}
          restored={restoredTerms.length > 0}
          fragmentBias={skippedTerms.length > 2 ? 0.24 : 0}
          reducedMotion={reducedMotion}
          speaking={!audioPaused && !audioMuted}
          labelPrefix="结尾文字"
        />
        <p className="ending-small">
          {restoredTerms.length > 0
            ? endingCopy.followed
            : '你没有把声音留下。她的话也仍然停在电话里。'}
        </p>

        <div className="ending-traces" aria-label="这次体验留下的痕迹">
          {restoredTerms.length > 0 && (
            <p>
              <span>跟读过的词</span>
              {restoredTerms.slice(-4).map((term) => term?.display).join(' · ')}
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
        <p>她还在和亲戚说话。电话底噪慢慢盖过了解释。</p>
        <button type="button" className="primary-button primary-button--small" onClick={onComplete}>
          {endingCopy.action}
        </button>
      </footer>
    </main>
  )
}