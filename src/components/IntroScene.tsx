import { introCopy } from '../data/story'

interface IntroSceneProps {
  onStart: () => void
  onOpenAbout: () => void
}

export function IntroScene({ onStart, onOpenAbout }: IntroSceneProps) {
  return (
    <main className="intro-scene">
      <div className="intro-thread" aria-hidden="true">
        <svg viewBox="0 0 640 70" preserveAspectRatio="none">
          <path
            className="intro-thread__path"
            d="M0 35 C44 35 47 23 79 31 S120 49 152 32 S192 13 224 34 S270 55 306 30 S350 18 382 35 S425 50 462 28 S512 22 548 36 S599 43 640 34"
          />
        </svg>
      </div>

      <section className="intro-content" aria-labelledby="intro-title">
        <p className="intro-kicker">一段声音叙事</p>
        <h1 id="intro-title">
          她在电话里
          <br />
          回到故乡
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
          <button type="button" className="text-button" onClick={onStart}>
            {introCopy.skip}
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