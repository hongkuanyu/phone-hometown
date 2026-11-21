import { useCallback, useEffect, useRef, useState } from 'react'
import { prologueCopy } from '../content/scenes'

interface PrologueSceneProps {
  onBegin: () => void
  onComplete: () => void
}

const PROLOGUE_TIMING = {
  hold: 180,
  fade: 900,
} as const

export function PrologueScene({ onBegin, onComplete }: PrologueSceneProps) {
  const [started, setStarted] = useState(false)
  const sentenceRef = useRef<HTMLParagraphElement>(null)
  const completedRef = useRef(false)

  const finishSequence = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    onComplete()
  }, [onComplete])

  useEffect(() => {
    if (!started) return

    let cancelled = false
    let startFrame = 0
    let animation: Animation | null = null
    let visibilityHandler: (() => void) | null = null

    startFrame = window.requestAnimationFrame(() => {
      if (cancelled) return
      const element = sentenceRef.current
      if (!element || typeof element.animate !== 'function') {
        finishSequence()
        return
      }

      animation = element.animate(
        [
          { opacity: 1, transform: 'translate3d(0, 0, 0)' },
          { opacity: 1, offset: 0.2 },
          { opacity: 0, transform: 'translate3d(0, -4px, 0)' },
        ],
        {
          delay: PROLOGUE_TIMING.hold,
          duration: PROLOGUE_TIMING.fade,
          easing: 'cubic-bezier(0.22, 0.68, 0.2, 1)',
          fill: 'both',
        },
      )
      animation.onfinish = () => {
        if (!cancelled) finishSequence()
      }

      visibilityHandler = () => {
        if (!animation) return
        if (document.hidden) animation.pause()
        else animation.play()
      }
      document.addEventListener('visibilitychange', visibilityHandler)
      visibilityHandler()
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(startFrame)
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler)
      }
      animation?.cancel()
    }
  }, [finishSequence, started])

  const handleBegin = () => {
    if (started) return
    setStarted(true)
    onBegin()
  }

  return (
    <main
      className="prologue-scene"
      aria-label="电话之前"
      data-prologue-state={started ? 'playing' : 'ready'}
    >
      <section className="prologue-content">
        <h1 className="sr-only">电话之前</h1>
        <span className="prologue-thread" aria-hidden="true" />

        <div className="prologue-sentences">
          <p
            ref={sentenceRef}
            className="prologue-sentence is-first"
            aria-live="polite"
            aria-atomic="true"
          >
            {prologueCopy.sentences[0]}
          </p>
        </div>

        <div
          className={`prologue-actions ${started ? 'is-hidden' : ''}`}
          aria-hidden={started}
        >
          <button
            type="button"
            className="prologue-continue"
            onClick={handleBegin}
            disabled={started}
            tabIndex={started ? -1 : 0}
            aria-describedby="prologue-sound-hint"
          >
            {prologueCopy.action}
          </button>
          <p id="prologue-sound-hint" className="prologue-sound-note">
            {prologueCopy.soundHint}
          </p>
        </div>
      </section>
    </main>
  )
}
