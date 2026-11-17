import { useEffect, useRef } from 'react'
import type { StoryTerm } from '../types'

interface MeaningDrawerProps {
  term: StoryTerm
  onClose: () => void
}

export function MeaningDrawer({ term, onClose }: MeaningDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="drawer-layer" role="presentation" onMouseDown={onClose}>
      <aside
        className="meaning-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meaning-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="meaning-drawer__header">
          <span className="meaning-drawer__kicker">词义抽屉</span>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="关闭词义抽屉"
          >
            关闭
          </button>
        </div>

        <h2 id="meaning-title">{term.display}</h2>
        <p className="meaning-drawer__family">{term.familyText}</p>

        <dl className="meaning-list">
          <div>
            <dt>方言读音</dt>
            <dd>{term.pronunciation}</dd>
          </div>
          <div>
            <dt>家庭转写</dt>
            <dd>{term.familyText}</dd>
          </div>
          <div>
            <dt>普通话解释</dt>
            <dd>{term.mandarinHint}</dd>
          </div>
          <div>
            <dt>生活场景</dt>
            <dd>{term.context}</dd>
          </div>
        </dl>

        <p className="placeholder-label">家庭转写待确认 · 不作为方言标准</p>
      </aside>
    </div>
  )
}