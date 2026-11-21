import { useEffect, useRef, useState } from 'react'
import { siteConfig } from '../config/site'
import { aboutCopy } from '../content/scenes'
import { allTerms } from '../content/terms'
import type { RecordedFragment } from '../types'

interface PathSummary {
  replayed: number
  explained: number
  inspected: number
  skipped: number
  untouched: number
}

interface AboutSceneProps {
  fragments: RecordedFragment[]
  rhythmRestoredCount: number
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

const motherRecordingCount = new Set(
  allTerms.filter((term) => term.audioSrc).map((term) => term.id),
).size

export function AboutScene({
  fragments,
  rhythmRestoredCount,
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

  const credits = [
    ['作者', siteConfig.credits.author],
    ['学校', siteConfig.credits.school],
    ['指导教师', siteConfig.credits.instructor],
    ['版权', siteConfig.credits.copyright],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]))

  const traceParts = [
    pathSummary.replayed > 0 ? `重听了 ${pathSummary.replayed} 次` : '',
    pathSummary.explained > 0 ? `问了她 ${pathSummary.explained} 次“啊？”` : '',
    pathSummary.inspected > 0 ? `看过 ${pathSummary.inspected} 次意思` : '',
    pathSummary.skipped > 0 ? `让 ${pathSummary.skipped} 句话先过去` : '',
  ].filter(Boolean)

  return (
    <main className="about-scene" aria-label={aboutCopy.aria}>
      <header className="about-header">
        <p className="about-kicker">作品与声音</p>
        <h1>{aboutCopy.title}</h1>
        <p className="about-lead">{aboutCopy.concept}</p>
      </header>

      <div className="about-content">
        <section className="about-section" aria-labelledby="about-work-title">
          <h2 id="about-work-title">作品与声音</h2>
          <p>{aboutCopy.creation}</p>
        </section>

        <section className="about-section" aria-labelledby="about-mother-title">
          <h2 id="about-mother-title">母亲留下的声音</h2>
          <p className="about-measure">{motherRecordingCount} 段</p>
          <p>{aboutCopy.motherArchive}</p>
        </section>

        <section className="about-section" aria-labelledby="about-user-title">
          <h2 id="about-user-title">你刚刚留下的声音</h2>
          <p className="about-measure">{fragments.length} 段</p>

          {fragments.length === 0 ? (
            <p className="archive-empty">这次没有留下录音。沉默也是完整的。</p>
          ) : (
            <ol className="archive-list">
              {fragments.map((fragment) => (
                <li key={fragment.id}>
                  <div className="archive-copy">
                    <strong>{fragment.label}</strong>
                    <span>
                      {fragment.source} · {formatDuration(fragment.duration)}
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

          {rhythmRestoredCount > 0 && (
            <p className="archive-note archive-note--rhythm">
              你用节奏补回了 {rhythmRestoredCount} 次。没有留下录音。
            </p>
          )}
          <p className="archive-note">
            这些声音只留在这一次打开的页面里。刷新或关闭以后，它们就会消失。
          </p>
        </section>

        <section className="about-section" aria-labelledby="about-traces-title">
          <h2 id="about-traces-title">这次体验中的一些痕迹</h2>
          <p>
            {traceParts.length > 0
              ? `这次你${traceParts.join('，')}。`
              : '这次你没有重听、追问或查看意思，只是听了一会儿。'}
          </p>
          {pathSummary.untouched > 0 && (
            <p>还有 {pathSummary.untouched} 句话，你没有停下来追问。</p>
          )}
        </section>

        <section className="about-section" aria-labelledby="about-transcript-title">
          <h2 id="about-transcript-title">声音与转写说明</h2>
          <p>{aboutCopy.transcript}</p>
          <p>{aboutCopy.collection}</p>
        </section>

        <section className="about-section" aria-labelledby="about-privacy-title">
          <h2 id="about-privacy-title">授权与隐私</h2>
          <p>{aboutCopy.authorization}</p>
          <p>{aboutCopy.permission}</p>
        </section>

        <section className="about-section about-section--technical" aria-labelledby="about-tech-title">
          <h2 id="about-tech-title">技术说明</h2>
          <p>{aboutCopy.technology}</p>
          <dl className="about-meta">
            <div>
              <dt>作品类型</dt>
              <dd>{siteConfig.workType}</dd>
            </div>
            <div>
              <dt>素材</dt>
              <dd>{siteConfig.materials}</dd>
            </div>
            {credits.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <footer className="about-actions">
        {canReturn && (
          <button type="button" className="quiet-button" onClick={onReturn}>
            继续听
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
          重新开始
        </button>
      </footer>
    </main>
  )
}
