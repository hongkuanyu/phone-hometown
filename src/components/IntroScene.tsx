import { useCallback, useEffect, useRef, useState } from 'react'
import { siteConfig } from '../config/site'
import { introCopy } from '../content/scenes'
import { callTerms } from '../content/terms'
import { GlassPrewarm } from './SoundTextCanvas'

interface IntroSceneProps {
  animateIntro: boolean
  reducedMotion: boolean
  onStart: () => void
  onIntroComplete: () => void
  onOpenAbout: () => void
}

const INTRO_TIMING = {
  total: 1600,
  lineDraw: 700,
  titleOneDelay: 120,
  titleOneDuration: 950,
  lineWaveDelay: 520,
  lineWaveDuration: 850,
  titleTwoDelay: 320,
  titleTwoDuration: 950,
  subtitleDelay: 820,
  subtitleDuration: 650,
  actionDelay: 420,
  actionDuration: 500,
  supportDelay: 980,
  supportDuration: 500,
  aboutDelay: 1000,
  aboutDuration: 450,
  assemblyDelay: 1050,
  assemblyDuration: 350,
  reduced: {
    total: 600,
    lineDraw: 200,
    titleOneDelay: 0,
    titleOneDuration: 300,
    lineWaveDelay: 100,
    lineWaveDuration: 250,
    titleTwoDelay: 80,
    titleTwoDuration: 300,
    subtitleDelay: 180,
    subtitleDuration: 250,
    actionDelay: 100,
    actionDuration: 200,
    supportDelay: 220,
    supportDuration: 200,
    aboutDelay: 230,
    aboutDuration: 180,
    assemblyDelay: 250,
    assemblyDuration: 150,
  },
} as const

const canUseWebAnimations = () =>
  typeof Element !== 'undefined' &&
  typeof Element.prototype.animate === 'function'

export function IntroScene({
  animateIntro,
  reducedMotion,
  onStart,
  onIntroComplete,
  onOpenAbout,
}: IntroSceneProps) {
  const shouldPlay = animateIntro && canUseWebAnimations()
  const [isPlaying, setIsPlaying] = useState(shouldPlay)
  const animationsRef = useRef<Animation[]>([])
  const pausedAnimationsRef = useRef(new Set<Animation>())
  const completedRef = useRef(!shouldPlay)
  const startLockRef = useRef(false)
  const pathRef = useRef<SVGPathElement>(null)
  const tracerRef = useRef<SVGPathElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const identityRef = useRef<HTMLParagraphElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const notesRef = useRef<HTMLDivElement>(null)
  const aboutRef = useRef<HTMLButtonElement>(null)
  const assemblyRef = useRef<HTMLSpanElement>(null)

  const completeIntro = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    const animations = animationsRef.current
    animationsRef.current = []
    pausedAnimationsRef.current.clear()

    animations.forEach((animation) => {
      try {
        animation.finish()
      } catch {
        animation.cancel()
      }
    })

    setIsPlaying(false)
    onIntroComplete()

    window.requestAnimationFrame(() => {
      animations.forEach((animation) => animation.cancel())
    })
  }, [onIntroComplete])

  useEffect(() => {
    if (!isPlaying) return

    let cancelled = false
    let startFrame = 0
    let effectAnimations: Animation[] = []
    const effectPausedAnimations = pausedAnimationsRef.current
    let visibilityHandler: (() => void) | null = null

    startFrame = window.requestAnimationFrame(() => {
      if (cancelled) return
      try {
        const path = pathRef.current
        const tracer = tracerRef.current
        const titleLines = Array.from(
          titleRef.current?.querySelectorAll<HTMLElement>(
            '.intro-title__line',
          ) ?? [],
        )
        const subtitle = subtitleRef.current
        const identity = identityRef.current
        const notes = notesRef.current
        const about = aboutRef.current
        const assembly = assemblyRef.current

        if (
          !path ||
          !tracer ||
          titleLines.length < 2 ||
          !subtitle ||
          !identity ||
          !notes ||
          !about ||
          !assembly
        ) {
          completeIntro()
          return
        }

        const animations: Animation[] = []
        const animate = (
          element: Element,
          keyframes: Keyframe[],
          options: KeyframeAnimationOptions,
        ) => {
          const animation = element.animate(keyframes, options)
          animations.push(animation)
          return animation
        }

        const motion = reducedMotion ? INTRO_TIMING.reduced : INTRO_TIMING
        const fullMotion = !reducedMotion

        animate(
          path,
          [
            { opacity: 0.1, strokeDashoffset: 1 },
            { opacity: 1, strokeDashoffset: 0 },
          ],
          {
            duration: motion.lineDraw,
            easing: 'cubic-bezier(0.2, 0.65, 0.2, 1)',
            fill: 'both',
          },
        )

        if (fullMotion) {
          animate(
            tracer,
            [
              { opacity: 0, strokeDashoffset: 1 },
              { opacity: 0.48, strokeDashoffset: 0.82, offset: 0.12 },
              { opacity: 0.56, strokeDashoffset: 0.18, offset: 0.7 },
              { opacity: 0, strokeDashoffset: -0.18 },
            ],
            {
              duration: 1000,
              easing: 'linear',
              fill: 'both',
            },
          )
          animate(
            path,
            [
              { transform: 'translateY(0px) scaleY(1)' },
              {
                transform: 'translateY(2.5px) scaleY(1.08)',
                offset: 0.46,
              },
              {
                transform: 'translateY(-0.5px) scaleY(0.985)',
                offset: 0.72,
              },
              { transform: 'translateY(0px) scaleY(1)' },
            ],
            {
              delay: motion.lineWaveDelay,
              duration: motion.lineWaveDuration,
              easing: 'ease-in-out',
              fill: 'both',
            },
          )
        }

        const titleKeyframes: Keyframe[] = fullMotion
          ? [
              {
                opacity: 0.04,
                transform: 'translate3d(0, 12px, 0) scale(0.985)',
                clipPath: 'inset(-6% 100% -6% 0)',
              },
              {
                opacity: 0.82,
                transform: 'translate3d(0, 3px, 0) scale(0.995)',
                clipPath: 'inset(-6% 28% -6% 0)',
                offset: 0.58,
              },
              {
                opacity: 1,
                transform: 'translate3d(0, 0, 0) scale(1)',
                clipPath: 'inset(0)',
              },
            ]
          : [{ opacity: 0 }, { opacity: 1 }]

        animate(titleLines[0], titleKeyframes, {
          delay: motion.titleOneDelay,
          duration: motion.titleOneDuration,
          easing: 'cubic-bezier(0.22, 0.72, 0.2, 1)',
          fill: 'both',
        })
        animate(titleLines[1], titleKeyframes, {
          delay: motion.titleTwoDelay,
          duration: motion.titleTwoDuration,
          easing: 'cubic-bezier(0.22, 0.72, 0.2, 1)',
          fill: 'both',
        })

        animate(
          subtitle,
          fullMotion
            ? [
                { opacity: 0, transform: 'translate3d(0, 6px, 0)' },
                { opacity: 1, transform: 'translate3d(0, 0, 0)' },
              ]
            : [{ opacity: 0 }, { opacity: 1 }],
          {
            delay: motion.subtitleDelay,
            duration: motion.subtitleDuration,
            easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
            fill: 'both',
          },
        )

        animate(
          identity,
          fullMotion
            ? [
                { opacity: 0, transform: 'translate3d(0, 4px, 0)' },
                { opacity: 1, transform: 'translate3d(0, 0, 0)' },
              ]
            : [{ opacity: 0 }, { opacity: 1 }],
          {
            delay: motion.subtitleDelay + 160,
            duration: motion.subtitleDuration,
            easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
            fill: 'both',
          },
        )

        animate(notes, [{ opacity: 0 }, { opacity: 1 }], {
          delay: motion.supportDelay,
          duration: motion.supportDuration,
          easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
          fill: 'both',
        })
        animate(assembly, [{ opacity: 0 }, { opacity: 1 }], {
          delay: motion.assemblyDelay,
          duration: motion.assemblyDuration,
          easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
          fill: 'both',
        })
        const aboutAnimation = animate(
          about,
          [{ opacity: 0 }, { opacity: 1 }],
          {
            delay: motion.aboutDelay,
            duration: motion.aboutDuration,
            easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
            fill: 'both',
          },
        )
        aboutAnimation.onfinish = () => {
          if (!cancelled) completeIntro()
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
      } catch {
        completeIntro()
      }
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
  }, [completeIntro, isPlaying, reducedMotion])

  const handleStart = () => {
    if (startLockRef.current) return
    startLockRef.current = true
    completeIntro()
    onStart()
  }

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const prewarmWidth =
    viewportWidth <= 720
      ? viewportWidth
      : Math.min(
          1408,
          viewportWidth * (viewportWidth <= 900 ? 0.96 : 0.92),
        )
  let prewarmHeight =
    viewportWidth <= 430
      ? Math.min(352, Math.max(224, viewportHeight * 0.37))
      : viewportWidth <= 720
        ? Math.min(416, Math.max(240, viewportHeight * 0.39))
        : Math.min(560, Math.max(304, viewportHeight * 0.49))
  if (viewportWidth > 720 && viewportHeight <= 760) {
    prewarmHeight = Math.min(400, Math.max(240, viewportHeight * 0.43))
  }

  return (
    <main
      className={`intro-scene ${isPlaying ? 'intro-scene--playing' : ''} ${isPlaying && reducedMotion ? 'intro-scene--reduced-playing' : ''}`}
      data-intro-state={isPlaying ? 'playing' : 'complete'}
      data-intro-reduced={reducedMotion}
      data-intro-total-ms={
        reducedMotion ? INTRO_TIMING.reduced.total : INTRO_TIMING.total
      }
    >
      <GlassPrewarm
        width={Math.round(prewarmWidth)}
        height={Math.round(prewarmHeight)}
        text={callTerms[0].display}
        chapter="call"
        reducedMotion={reducedMotion}
      />

      <div className="intro-thread" aria-hidden="true">
        <svg viewBox="0 0 640 70" preserveAspectRatio="none">
          <path
            ref={pathRef}
            pathLength={1}
            className="intro-thread__path"
            d="M0 35 C44 35 47 23 79 31 S120 49 152 32 S192 13 224 34 S270 55 306 30 S350 18 382 35 S425 50 462 28 S512 22 548 36 S599 43 640 34"
          />
          <path
            ref={tracerRef}
            pathLength={1}
            className="intro-thread__tracer"
            d="M0 35 C44 35 47 23 79 31 S120 49 152 32 S192 13 224 34 S270 55 306 30 S350 18 382 35 S425 50 462 28 S512 22 548 36 S599 43 640 34"
          />
        </svg>
      </div>

      <p className="intro-archive-mark" aria-hidden="true">
        <span>家庭声音档案</span>
        <span>CHANGZHOU / 01</span>
      </p>

      <section className="intro-content" aria-labelledby="intro-title">
        <h1 ref={titleRef} id="intro-title">
          {siteConfig.titleLines.map((line) => (
            <span key={line} className="intro-title__line">
              {line}
            </span>
          ))}
        </h1>
        <p ref={subtitleRef} className="intro-subtitle">
          {introCopy.subtitle}
        </p>
        <p ref={identityRef} className="intro-identity">{introCopy.identity}</p>

        <div ref={actionsRef} className="intro-actions">
          <button
            type="button"
            className="intro-listen-button"
            onClick={handleStart}
            tabIndex={isPlaying ? -1 : 0}
          >
            {introCopy.answer}
          </button>
        </div>

        <div ref={notesRef} className="intro-meta-rail" aria-label="作品信息">
          <span className="intro-meta-item">
            <span className="intro-meta-key">地点</span>
            <strong>常州</strong>
          </span>
          <span className="intro-meta-item">
            <span className="intro-meta-key">母亲录音</span>
            <strong>17 段</strong>
          </span>
          <span className="intro-meta-item intro-listening-note">
            <span className="intro-meta-key">聆听</span>
            <strong>{introCopy.listening}</strong>
          </span>
          <button
            ref={aboutRef}
            type="button"
            className="intro-about"
            onClick={onOpenAbout}
            tabIndex={isPlaying ? -1 : 0}
          >
            {introCopy.about}
          </button>
        </div>
      </section>

      <span ref={assemblyRef} className="intro-assembly" aria-hidden="true" />
    </main>
  )
}
