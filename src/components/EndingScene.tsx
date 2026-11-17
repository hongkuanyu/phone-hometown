import { useEffect } from 'react'
import { endingCopy } from '../data/story'
import { PhoneChrome } from './PhoneChrome'
import { SoundTextCanvas } from './SoundTextCanvas'

interface EndingSceneProps {
  timer: string
  audioLevel: number
  audioMuted: boolean
  subtitleVisible: boolean
  reducedMotion: boolean
  restoredCount: number
  onToggleAudio: () => void
  onToggleSubtitles: () => void
  onOpenAbout: () => void
  onComplete: () => void
}

export function EndingScene({
  timer,
  audioLevel,
  audioMuted,
  subtitleVisible,
  reducedMotion,
  restoredCount,
  onToggleAudio,
  onToggleSubtitles,
  onOpenAbout,
  onComplete,
}: EndingSceneProps) {
  useEffect(() => {
    const timerId = window.setTimeout(onComplete, 7500)
    return () => window.clearTimeout(timerId)
  }, [onComplete])

  return (
    <main className="ending-scene">
      <PhoneChrome
        timer={timer}
        stage="电话"
        audioMuted={audioMuted}
        subtitleVisible={subtitleVisible}
        onToggleAudio={onToggleAudio}
        onToggleSubtitles={onToggleSubtitles}
        onOpenAbout={onOpenAbout}
      />

      <section className="ending-field">
        <p className="ending-lead">{endingCopy.lead}</p>
        <SoundTextCanvas
          text={endingCopy.title}
          stateKey="ending"
          replayToken={0}
          audioLevel={audioLevel}
          restoration={restoredCount > 0 ? 0.42 : 0.1}
          restored={restoredCount > 0}
          reducedMotion={reducedMotion}
          labelPrefix="结尾文字"
        />
        <p className="ending-small">
          {restoredCount > 0
            ? '你接入过几个笔画。最后一个词仍然没有完整回来。'
            : '你没有把声音留下。她的话也仍然停在电话里。'}
        </p>
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