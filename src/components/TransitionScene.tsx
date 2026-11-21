import { useCallback, useEffect, useRef, useState } from 'react'
import { coolingTerms } from '../content/terms'
import { SoundTextCanvas } from './SoundTextCanvas'

export type TransitionDirection = 'memory' | 'reality'

interface TransitionSceneProps {
  direction: TransitionDirection
  audioLevel: number
  reducedMotion: boolean
  onComplete: () => void
}

export function TransitionScene({
  direction,
  audioLevel,
  reducedMotion,
  onComplete,
}: TransitionSceneProps) {
  const [phase, setPhase] = useState(0)
  const completedRef = useRef(false)

  const finish = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    onComplete()
  }, [onComplete])

  useEffect(() => {
    completedRef.current = false

    if (direction === 'memory') {
      const phraseTimer = window.setTimeout(
        () => setPhase(1),
        reducedMotion ? 600 : 1700,
      )
      const finishTimer = window.setTimeout(
        finish,
        reducedMotion ? 1800 : 5200,
      )
      return () => {
        window.clearTimeout(phraseTimer)
        window.clearTimeout(finishTimer)
      }
    }

    const finishTimer = window.setTimeout(
      finish,
      reducedMotion ? 1800 : 4800,
    )
    return () => window.clearTimeout(finishTimer)
  }, [direction, finish, reducedMotion])

  const text =
    direction === 'memory'
      ? phase === 0
        ? '灶火退远'
        : coolingTerms[0].display
      : coolingTerms[coolingTerms.length - 1].display

  return (
    <main className={`transition-scene transition-scene--${direction}`}>
      <section className={`transition-field transition-field--${direction}`}>
        {direction === 'reality' && (
          <span className="transition-reality-thread" aria-hidden="true" />
        )}
        <SoundTextCanvas
          text={text}
          stateKey={`${direction}-${phase}`}
          replayToken={0}
          audioLevel={audioLevel}
          restoration={0}
          reducedMotion={reducedMotion}
          speaking={false}
          chapter="transition"
          fractureMode="timed"
          labelPrefix={direction === 'memory' ? '夏夜记忆' : '电话那头'}
        />
      </section>
    </main>
  )
}
