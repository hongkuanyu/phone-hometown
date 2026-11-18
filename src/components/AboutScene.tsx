import { useEffect, useRef, useState } from 'react'
import { aboutCopy } from '../content/scenes'
import type { RecordedFragment } from '../types'

interface PathSummary {
  replayed: number
  explained: number
  skipped: number
  followed: number
  inspected: number
}

interface AboutSceneProps {
  fragments: RecordedFragment[]
  pathSummary: PathSummary
  canReturn: boolean
  onReturn: () => void
  onRestart: () => void
  onHome: () => void
}

const formatDuration = (milliseconds: number) => {
  const seconds = Math.max(0, milliseconds / 1000)
  return `${seconds.toFixed(1)} 秒`
}

export function AboutScene({
  fragments,
  pathSummary,
  canReturn,
  onReturn,
  onRestart,
  onHome,
}: AboutSceneProps) {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  const togglePlayback = (fragment: RecordedFragment) => {
    if (playingId === fragment.id && audioRef.current) {
      audioRef.current.pause()
      setPlayingId(null)
      return
    }

    audioRef.current?.pause()
    const audio = new Audio(fragment.url)
    audioRef.current = audio
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => setPlayingId(null)
    void audio
      .play()
      .then(() => setPlayingId(fragment.id))
      .catch(() => setPlayingId(null))
  }

  return (
    <main className="about-scene" aria-label={aboutCopy.aria}>
      <header className="about-header">
        <p className="about-kicker">声音档案 · 仅限当前标签页</p>
        <h1>{aboutCopy.title}</h1>
        <p className="about-lead">{aboutCopy.concept}</p>
      </header>

      <div className="about-grid">
        <section className="archive-section" aria-labelledby="archive-title">
          <div className="section-heading">
            <h2 id="archive-title">这次留下的片段</h2>
            <span>{fragments.length.toString().padStart(2, '0')}</span>
          </div>

          {fragments.length === 0 ? (
            <p className="archive-empty">这次没有留下录音。沉默也是完整的。</p>
          ) : (
            <ol className="archive-list">
              {fragments.map((fragment, index) => (
                <li key={fragment.id}>
                  <span className="archive-index">
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                  <div className="archive-copy">
                    <strong>{fragment.label}</strong>
                    <span>
                      {fragment.source} · {formatDuration(fragment.duration)} · 只存在于本页
                    </span>
                  </div>
                  <button
                    type="button"
                    className="archive-play"
                    aria-pressed={playingId === fragment.id}
                    onClick={() => togglePlayback(fragment)}
                  >
                    {playingId === fragment.id ? '暂停' : '回听'}
                  </button>
                </li>
              ))}
            </ol>
          )}

          <p className="archive-note">
            录音不上传、不写入存储。关闭或刷新标签页后，档案自动消失。
          </p>

          <div className="path-summary" aria-label="这次体验的停留方式">
            <span>重听 {pathSummary.replayed}</span>
            <span>追问 {pathSummary.explained}</span>
            <span>查看 {pathSummary.inspected}</span>
            <span>跳过 {pathSummary.skipped}</span>
            <span>跟读 {pathSummary.followed}</span>
          </div>
        </section>

        <section className="about-notes" aria-labelledby="notes-title">
          <h2 id="notes-title">关于这部作品</h2>
          <p>{aboutCopy.creation}</p>
          <details>
            <summary>家庭转写说明</summary>
            <p>{aboutCopy.transcript}</p>
          </details>
          <details>
            <summary>声音采集说明</summary>
            <p>{aboutCopy.collection}</p>
          </details>
          <details>
            <summary>录音授权说明</summary>
            <p>{aboutCopy.authorization}</p>
          </details>
          <details>
            <summary>麦克风与隐私</summary>
            <p>{aboutCopy.permission}</p>
          </details>
          <details>
            <summary>技术说明</summary>
            <p>{aboutCopy.technology}</p>
          </details>
        </section>
      </div>

      <footer className="about-actions">
        {canReturn && (
          <button type="button" className="quiet-button" onClick={onReturn}>
            回到刚才的电话
          </button>
        )}
        <button type="button" className="quiet-button" onClick={onHome}>
          返回首页
        </button>
        <button
          type="button"
          className="primary-button primary-button--small"
          onClick={onRestart}
        >
          重播整段体验
        </button>
      </footer>
    </main>
  )
}