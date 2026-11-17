import { useEffect, useRef, useState } from 'react'
import type { Choice, MicPermission, StoryChapter, StoryTerm } from '../types'
import { useMicRecorder } from '../hooks/useMicRecorder'
import type { VoiceClip } from '../hooks/useMicRecorder'
import { MeaningDrawer } from './MeaningDrawer'
import { PhoneChrome } from './PhoneChrome'
import { SoundTextCanvas } from './SoundTextCanvas'

interface StorySceneProps {
  chapter: StoryChapter
  termIndex: number
  timer: string
  audioLevel: number
  audioMuted: boolean
  subtitleVisible: boolean
  translationOpen: boolean
  restoredTermIds: string[]
  reducedMotion: boolean
  onToggleAudio: () => void
  onToggleSubtitles: () => void
  onOpenAbout: () => void
  onAdvance: () => void
  onPlayTerm: (term: StoryTerm, rate?: number) => void
  onExplain: (term: StoryTerm) => void
  onOpenMeaning: () => void
  onCloseMeaning: () => void
  onRestore: (termId: string) => void
  onSaveClip: (term: StoryTerm, clip: VoiceClip) => void
  onMicPermission: (permission: MicPermission) => void
  onChoice: (choice: Choice) => void
}

const followStatusCopy = {
  idle: '按住跟读 · 最长 5 秒',
  requesting: '正在等待麦克风权限',
  recording: '正在记录你的节奏 · 松开结束',
  listening: '麦克风已开启 · 当前浏览器不能保存录音',
  fallback: '节奏替代模式 · 没有使用麦克风',
}

export function StoryScene({
  chapter,
  termIndex,
  timer,
  audioLevel,
  audioMuted,
  subtitleVisible,
  translationOpen,
  restoredTermIds,
  reducedMotion,
  onToggleAudio,
  onToggleSubtitles,
  onOpenAbout,
  onAdvance,
  onPlayTerm,
  onExplain,
  onOpenMeaning,
  onCloseMeaning,
  onRestore,
  onSaveClip,
  onMicPermission,
  onChoice,
}: StorySceneProps) {
  const term = chapter.terms[termIndex]
  const [pulse, setPulse] = useState(0)
  const termRef = useRef(term)
  const playedRef = useRef('')
  const isCooling = chapter.scene === 'cooling'
  const isRestored = restoredTermIds.includes(term.id)

  termRef.current = term

  const mic = useMicRecorder({
    onPermission: onMicPermission,
    onClip: (clip) => {
      const activeTerm = termRef.current
      onRestore(activeTerm.id)
      onChoice({ scene: chapter.scene, type: 'save', termId: activeTerm.id })
      onSaveClip(activeTerm, clip)
    },
  })

  useEffect(() => {
    setPulse((value) => value + 1)
    if (audioMuted) return
    if (playedRef.current === term.id) return
    playedRef.current = term.id
    onPlayTerm(term, term.voiceRate ?? 1)
  }, [term, audioMuted, onPlayTerm])

  // Space is a no-mic rhythm alternative and never asks for permission.
  useEffect(() => {
    if (!isCooling) return
    const isInteractiveTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      Boolean(target.closest('button, a, input, textarea, select, [role="dialog"]'))

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || isInteractiveTarget(event.target)) {
        return
      }
      event.preventDefault()
      void mic.startHold()
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isInteractiveTarget(event.target)) return
      event.preventDefault()
      if (mic.isActive) {
        onRestore(termRef.current.id)
        onChoice({ scene: chapter.scene, type: 'follow', termId: termRef.current.id })
      }
      mic.stopHold()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [chapter.scene, isCooling, mic, onChoice, onRestore])

  const replay = (slow = false) => {
    onChoice({ scene: chapter.scene, type: 'replay', termId: term.id })
    setPulse((value) => value + 1)
    onPlayTerm(term, (term.voiceRate ?? 1) * (slow ? 0.78 : 1))
  }

  const explain = () => {
    onChoice({ scene: chapter.scene, type: 'explain', termId: term.id })
    setPulse((value) => value + 1)
    onRestore(term.id)
    onExplain(term)
  }

  const openMeaning = () => {
    onChoice({ scene: chapter.scene, type: 'meaning', termId: term.id })
    onOpenMeaning()
  }

  const skip = () => {
    onChoice({ scene: chapter.scene, type: 'skip', termId: term.id })
    onAdvance()
  }

  const pretend = () => {
    onChoice({ scene: chapter.scene, type: 'pretend', termId: term.id })
    onAdvance()
  }

  const beginFollow = () => {
    void mic.startHold()
  }

  const endFollow = () => {
    if (mic.isActive) {
      onRestore(term.id)
      onChoice({ scene: chapter.scene, type: 'follow', termId: term.id })
    }
    mic.stopHold()
  }

  const handleFollowPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    beginFollow()
  }

  const handleFollowPointerUp = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    endFollow()
  }

  const handleFollowKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
      event.preventDefault()
      beginFollow()
    }
  }

  const handleFollowKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      endFollow()
    }
  }

  const nextLabel =
    termIndex === chapter.terms.length - 1 ? chapter.nextLabel : '听下一句'
  const followCopy =
    mic.permission === 'denied' && mic.status === 'idle'
      ? '麦克风未开启 · 按住仍可复原文字'
      : followStatusCopy[mic.status]

  return (
    <main
      className={`story-scene story-scene--${chapter.scene}`}
      style={{ '--voice-level': audioLevel } as React.CSSProperties}
    >
      <PhoneChrome
        timer={timer}
        stage={chapter.stage}
        audioMuted={audioMuted}
        subtitleVisible={subtitleVisible}
        onToggleAudio={onToggleAudio}
        onToggleSubtitles={onToggleSubtitles}
        onOpenAbout={onOpenAbout}
      />

      <section className="story-field" aria-labelledby="story-term-label">
        <div className="field-meta">
          <span className="speaker-mark" aria-hidden="true" />
          <span id="story-term-label">母亲的声音</span>
          <span className="field-meta__state">
            {mic.isActive ? '你的笔画正在接入' : isRestored ? '部分复原，仍有错位' : '聚拢，松开'}
          </span>
        </div>

        <SoundTextCanvas
          text={term.display}
          stateKey={term.id}
          replayToken={pulse}
          audioLevel={audioLevel}
          restoration={Math.max(mic.energy, isRestored ? 0.32 : 0)}
          reducedMotion={reducedMotion}
          restored={isRestored}
          labelPrefix="母亲的话"
        />

        <div className="sound-rail" aria-hidden="true">
          <span />
        </div>

        <p className="chapter-note">{chapter.chapterNote}</p>
      </section>

      <footer className="story-footer">
        <section className="cue-panel" aria-label="当前情境">
          <p className="cue-panel__beat">
            {chapter.eyebrow} · {term.beat} · {termIndex + 1}/{chapter.terms.length}
          </p>
          {subtitleVisible && (
            <p className="subtitle-line">
              <span>普通话提示</span>
              {term.mandarinHint}
            </p>
          )}

          <div className="action-row">
            <button type="button" className="quiet-button" onClick={() => replay(true)}>
              再听一遍
            </button>
            <button type="button" className="quiet-button" onClick={explain}>
              请母亲解释
            </button>
            <button type="button" className="quiet-button" onClick={openMeaning}>
              查看意思
            </button>
            {isCooling && (
              <button type="button" className="quiet-button" onClick={pretend}>
                装作听懂
              </button>
            )}
            <button type="button" className="quiet-button" onClick={skip}>
              先跳过
            </button>
            <button type="button" className="primary-button primary-button--small" onClick={onAdvance}>
              {nextLabel}
            </button>
          </div>
        </section>

        {isCooling && (
          <section className={`follow-panel ${mic.isActive ? 'is-active' : ''}`}>
            <p className="follow-panel__title">按住跟读，松开后留进声音档案</p>
            <button
              type="button"
              className="hold-button"
              onPointerDown={handleFollowPointerDown}
              onPointerUp={handleFollowPointerUp}
              onPointerCancel={endFollow}
              onKeyDown={handleFollowKeyDown}
              onKeyUp={handleFollowKeyUp}
              onContextMenu={(event) => event.preventDefault()}
              aria-describedby="follow-help"
            >
              <span className="hold-button__ring" aria-hidden="true" />
              按住跟读
            </button>
            <p id="follow-help" className="follow-panel__status" aria-live="polite">
              {followCopy}
            </p>
            <p className="follow-panel__privacy">
              只分析音量、起音和节奏，不识别、不评分、不上传。
            </p>
          </section>
        )}
      </footer>

      {translationOpen && (
        <MeaningDrawer term={term} onClose={onCloseMeaning} />
      )}
    </main>
  )
}