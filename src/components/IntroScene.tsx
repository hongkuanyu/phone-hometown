import { siteConfig } from '../config/site'
import { introCopy } from '../content/scenes'
import { callTerms } from '../content/terms'
import { GlassPrewarm } from './SoundTextCanvas'

interface IntroSceneProps {
  onStart: () => void
  onOpenAbout: () => void
}

export function IntroScene({ onStart, onOpenAbout }: IntroSceneProps) {
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
    <main className="intro-scene">
      <GlassPrewarm
        width={Math.round(prewarmWidth)}
        height={Math.round(prewarmHeight)}
        text={callTerms[0].display}
        chapter="call"
        reducedMotion={window.matchMedia('(prefers-reduced-motion: reduce)').matches}
      />
      <div className="intro-thread" aria-hidden="true">
        <svg viewBox="0 0 640 70" preserveAspectRatio="none">
          <path
            className="intro-thread__path"
            d="M0 35 C44 35 47 23 79 31 S120 49 152 32 S192 13 224 34 S270 55 306 30 S350 18 382 35 S425 50 462 28 S512 22 548 36 S599 43 640 34"
          />
        </svg>
      </div>

      <section className="intro-content" aria-labelledby="intro-title">
        <p className="intro-kicker">{introCopy.duration}</p>
        <h1 id="intro-title">
          {siteConfig.titleLines.map((line, index) => (
            <span key={line}>
              {line}
              {index < siteConfig.titleLines.length - 1 && <br />}
            </span>
          ))}
        </h1>
        <p className="intro-subtitle">
          一个不会说常州话的年轻人，
          <br />
          试图听懂母亲电话里的声音。
        </p>

        <div className="intro-actions">
          <button type="button" className="primary-button" onClick={onStart}>
            {introCopy.answer}
          </button>
        </div>

        <dl className="intro-notes">
          <div>
            <dt>耳机</dt>
            <dd>{introCopy.listening}</dd>
          </div>
          <div>
            <dt>麦克风</dt>
            <dd>{introCopy.privacy}</dd>
          </div>
        </dl>

        <button type="button" className="intro-about" onClick={onOpenAbout}>
          {introCopy.about}
        </button>
      </section>

      <span className="intro-assembly" aria-hidden="true">
        声音会先抵达，意思可以迟到
      </span>
    </main>
  )
}