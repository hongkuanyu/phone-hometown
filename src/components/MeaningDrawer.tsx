import { useEffect, useRef } from 'react'
import type { StoryTerm } from '../types'

interface MeaningDrawerProps {
  term: StoryTerm
  explained: boolean
  onClose: () => void
}

export function MeaningDrawer({ term, explained, onClose }: MeaningDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !drawerRef.current) return

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input, summary, [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="drawer-layer" role="presentation" onMouseDown={onClose}>
      <aside
        ref={drawerRef}
        className="meaning-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meaning-title"
        aria-describedby="meaning-summary"
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
        <p id="meaning-summary" className="meaning-drawer__family">
          {term.familyText}
        </p>

        <dl className="meaning-list">
          <div>
            <dt>近似读音</dt>
            <dd>{term.pronunciation}</dd>
          </div>
          <div>
            <dt>家庭转写</dt>
            <dd>{term.familyText}</dd>
          </div>
          <div>
            <dt>这句话的生活意思</dt>
            <dd>{term.mandarinHint}</dd>
          </div>
          <div>
            <dt>生活场景</dt>
            <dd>{term.context}</dd>
          </div>
          {explained && (
            <div>
              <dt>母亲又补充了一句</dt>
              <dd>{term.supplement}</dd>
            </div>
          )}
        </dl>

        <p className="meaning-drawer__footnote">
          写法与读音来自家庭记忆中的地方表达，不代替真实录音。
        </p>
      </aside>
    </div>
  )
}