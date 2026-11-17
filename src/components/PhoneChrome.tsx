interface PhoneChromeProps {
  timer: string
  stage: string
  audioMuted: boolean
  subtitleVisible: boolean
  onToggleAudio: () => void
  onToggleSubtitles: () => void
  onOpenAbout: () => void
}

export function PhoneChrome({
  timer,
  stage,
  audioMuted,
  subtitleVisible,
  onToggleAudio,
  onToggleSubtitles,
  onOpenAbout,
}: PhoneChromeProps) {
  return (
    <header className="phone-chrome">
      <div className="call-meta" aria-label={`通话中，${timer}，${stage}`}>
        <span className="call-meta__dot" aria-hidden="true" />
        <span>通话中</span>
        <time>{timer}</time>
        <span className="call-meta__stage">{stage}</span>
      </div>

      <div className="utility-controls">
        <button
          type="button"
          className="utility-button"
          aria-pressed={!audioMuted}
          onClick={onToggleAudio}
        >
          声音：{audioMuted ? '关' : '开'}
        </button>
        <button
          type="button"
          className="utility-button"
          aria-pressed={subtitleVisible}
          onClick={onToggleSubtitles}
        >
          普通话提示：{subtitleVisible ? '开' : '关'}
        </button>
        <button type="button" className="utility-button" onClick={onOpenAbout}>
          作品信息
        </button>
      </div>
    </header>
  )
}