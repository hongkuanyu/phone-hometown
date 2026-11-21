import { useCallback, useEffect, useRef, useState } from 'react'
import { prologueCopy } from '../content/scenes'

interface PrologueSceneProps {
  onBegin: () => void
  onComplete: () => void
}

const SENTENCE_TIMING = {
  initialFadeOut: 1600,
  step: 2800,
  sentenceDuration: 2600,
} as const

export function PrologueScene({ onBegin, onComplete }: PrologueSceneProps) {
  const [started, setStarted] = useState(false)
  const [activeSentence, setActiveSentence] = useState(0)
  const sentenceRefs = useRef<Array<HTMLParagraphElement | null>>([])
  const animationsRef = useRef<Animation[]>([])
  const pausedAnimationsRef = useRef(new Set<Animation>())
  const completedRef = useRef(false)

  const finishSequence = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    animationsRef.current = []
    pausedAnimationsRef.current.clear()
    // Keep the final invisible animation state until React unmounts this
    // scene, otherwise the first sentence's base CSS can flash back for a frame.
    onComplete()
  }, [onComplete])

  useEffect(() => {
    if (!started) return

    let cancelled = false
    let startFrame = 0
    let effectAnimations: Animation[] = []
    const effectPausedAnimations = pausedAnimationsRef.current
    let visibilityHandler: (() => void) | null = null

    startFrame = window.requestAnimationFrame(() => {
      if (cancelled) return
      const elements = sentenceRefs.current.filter(
        (element): element is HTMLParagraphElement => Boolean(element),
      )
      if (elements.length !== prologueCopy.sentences.length) {
        finishSequence()
        return
      }

      const animations: Animation[] = []
      const first = elements[0].animate(
        [
          { opacity: 1 },
          { opacity: 1, offset: 0.42 },
          { opacity: 0 },
        ],
        {
          duration: SENTENCE_TIMING.initialFadeOut,
          easing: 'ease-in-out',
          fill: 'both',
        },
      )
      animations.push(first)

      elements.slice(1).forEach((element, index) => {
        const animation = element.animate(
          [
            { opacity: 0 },
            { opacity: 1, offset: 0.2 },
            { opacity: 1, offset: 0.72 },
            { opacity: 0 },
          ],
          {
            delay:
              SENTENCE_TIMING.initialFadeOut +
              index * SENTENCE_TIMING.step,
            duration: SENTENCE_TIMING.sentenceDuration,
            easing: 'ease-in-out',
            fill: 'both',
          },
        )
        animation.onfinish = () => {
          if (cancelled) return
          if (index < elements.length - 2) {
            setActiveSentence(index + 2)
          } else {
            finishSequence()
          }
        }
        animations.push(animation)
      })

      first.onfinish = () => {
        if (!cancelled) setActiveSentence(1)
      }

      animationsRef.current = animations
      effectAnimations = animations
      visibilityHandler = () => {
        if (document.hidden) {
          effectAnimations.forEach((animation) => {
            if (animation.pending || animation.playState === 'running') {
              animation.pause()
              effectPausedAnimations.add(animation)
            }
          })
          return
        }
        effectPausedAnimations.forEach((animation) => animation.play())
        effectPausedAnimations.clear()
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
      effectAnimations.forEach((animation) => animation.cancel())
      effectAnimations = []
      effectPausedAnimations.clear()
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

        <div className="prologue-sentences" aria-hidden="true">
          {prologueCopy.sentences.map((sentence, index) => (
            <p
              key={sentence}
              ref={(element) => {
                sentenceRefs.current[index] = element
              }}
              className={`prologue-sentence ${index === 0 ? 'is-first' : ''}`}
            >
              {sentence}
            </p>
          ))}
        </div>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {prologueCopy.sentences[activeSentence]}
        </p>

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

        {started && (
          <button
            type="button"
            className="intro-skip"
            onClick={finishSequence}
          >
            {prologueCopy.skip}
          </button>
        )}
      </section>
    </main>
  )
}
