import { useEffect, useState } from 'react'
import { PhoneChrome } from './PhoneChrome'
import { SoundTextCanvas } from './SoundTextCanvas'

interface TransitionSceneProps {
  timer: string
  audioLevel: number
  audioMuted: boolean
  subtitleVisible: boolean
  reducedMotion: boolean
  onToggleAudio: () => void
  onToggleSubtitles: () => void
  onOpenAbout: () => void
  onComplete: () => void
}

export function TransitionScene({
  timer,
  audioLevel,
  audioMuted,
  subtitleVisible,
  reducedMotion,
  onToggleAudio,
  onToggleSubtitles,
  onOpenAbout,
  onComplete,
}: TransitionSceneProps) {
  const [text, setText] = useState('风过竹榻')

  useEffect(() => {
    const textTimer = window.setTimeout(() => setText('竹榻搬出来乘风凉'), 1400)
    const finishTimer = window.setTimeout(onComplete, 4000)
    return () => {
      window.clearTimeout(textTimer)
      window.clearTimeout(finishTimer)
    }
  }, [onComplete])

  return (
    <main className="transition-scene">
      <PhoneChrome
        timer={timer}
        stage="转场"
        audioMuted={audioMuted}
        subtitleVisible={subtitleVisible}
        onToggleAudio={onToggleAudio}
        onToggleSubtitles={onToggleSubtitles}
        onOpenAbout={onOpenAbout}
      />

      <section className="transition-field">
        <p className="transition-caption">灶火退远，虫鸣靠近</p>
        <SoundTextCanvas
          text={text}
          stateKey={text}
          replayToken={0}
          audioLevel={audioLevel}
          restoration={0}
          reducedMotion={reducedMotion}
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