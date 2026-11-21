import type { PlaybackRate } from '../types'

const speeds: PlaybackRate[] = [0.85, 1, 1.15]

interface PhoneChromeProps {
  timer: string
  stage: string
  audioMuted: boolean
  audioPaused: boolean
  subtitleVisible: boolean
  playbackRate: PlaybackRate
  ambientVolume: number
  voiceVolume: number
  showChapterRestart?: boolean
  onToggleAudio: () => void
  onTogglePause: () => void
  onToggleSubtitles: () => void
  onSetPlaybackRate: (rate: PlaybackRate) => void
  onSetAmbientVolume: (volume: number) => void
  onSetVoiceVolume: (volume: number) => void
  onRestartChapter?: () => void
  onOpenAbout: () => void
}

export function PhoneChrome({
  timer,
  stage,
  audioMuted,
  audioPaused,
  subtitleVisible,
  playbackRate,
  ambientVolume,
  voiceVolume,
  showChapterRestart = false,
  onToggleAudio,
  onTogglePause,
  onToggleSubtitles,
  onSetPlaybackRate,
  onSetAmbientVolume,
  onSetVoiceVolume,
  onRestartChapter,
  onOpenAbout,
}: PhoneChromeProps) {
  return (
    <header className="phone-chrome">
      <div className="call-meta" aria-label={`通话中，${timer}${stage ? `，${stage}` : ''}`}>
        <span className="call-meta__dot" aria-hidden="true" />
        <span>通话中</span>
        <time>{timer}</time>
        {stage && <span className="call-meta__stage">{stage}</span>}
      </div>

      <div className="utility-controls">
        <details
          className="playback-settings sound-settings"
          data-muted={audioMuted}
        >
          <summary
            className="utility-button playback-settings__summary"
            aria-label={`声音设置，当前声音${audioMuted ? '关闭' : '开启'}`}
          >
            声音
          </summary>
          <div className="playback-panel">
            <div className="playback-panel__actions">
              <button
                type="button"
                className="panel-button"
                aria-pressed={!audioMuted}
                onClick={onToggleAudio}
              >
                {audioMuted ? '开启声音' : '关闭声音'}
              </button>
              <button
                type="button"
                className="panel-button"
                onClick={onTogglePause}
                disabled={audioMuted}
              >
                {audioPaused ? '继续声音' : '暂停声音'}
              </button>
              {showChapterRestart && onRestartChapter && (
                <button
                  type="button"
                  className="panel-button"
                  onClick={onRestartChapter}
                  aria-label="重新开始当前章节"
                >
                  重听本章
                </button>
              )}
            </div>

            <fieldset className="speed-control">
              <legend>播放速度</legend>
              <div>
                {speeds.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    className="speed-button"
                    aria-pressed={playbackRate === speed}
                    onClick={() => onSetPlaybackRate(speed)}
                  >
                    {speed}×
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="range-control">
              <span>
                环境声 <strong>{Math.round(ambientVolume * 100)}</strong>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round(ambientVolume * 100)}
                onChange={(event) =>
                  onSetAmbientVolume(Number(event.target.value) / 100)
                }
              />
            </label>

            <label className="range-control">
              <span>
                母亲声音 <strong>{Math.round(voiceVolume * 100)}</strong>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round(voiceVolume * 100)}
                onChange={(event) =>
                  onSetVoiceVolume(Number(event.target.value) / 100)
                }
              />
            </label>
          </div>
        </details>

        <button
          type="button"
          className="utility-button"
          aria-pressed={subtitleVisible}
          onClick={onToggleSubtitles}
        >
          提示：{subtitleVisible ? '开' : '关'}
        </button>
        <button type="button" className="utility-button" onClick={onOpenAbout}>
          作品信息
        </button>
      </div>
    </header>
  )
}