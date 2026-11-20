import { prologueCopy } from '../content/scenes'

interface PrologueSceneProps {
  onContinue: () => void
}

export function PrologueScene({ onContinue }: PrologueSceneProps) {
  return (
    <main className="prologue-scene" aria-labelledby="prologue-title">
      <section className="prologue-content">
        <span className="prologue-thread" aria-hidden="true" />
        <h1 id="prologue-title" className="prologue-title">
          {prologueCopy.title}
        </h1>
        <div className="prologue-copy">
          <p>{prologueCopy.weather}</p>
          <p>{prologueCopy.distance}</p>
        </div>
        <button
          type="button"
          className="prologue-continue"
          onClick={onContinue}
        >
          {prologueCopy.action}
        </button>
      </section>
    </main>
  )
}
