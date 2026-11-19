import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AudioPlaybackResult,
  Choice,
  MicPermission,
  PlaybackRate,
  StoryChapter,
  StoryTerm,
} from '../types'
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
  audioPaused: boolean
  subtitleVisible: boolean
  translationOpen: boolean
  restoredTermIds: string[]
  skippedTermIds: string[]
  explainedTermIds: string[]
  reducedMotion: boolean
  playbackRate: PlaybackRate
  ambientVolume: number
  voiceVolume: number
  onToggleAudio: () => void
  onTogglePause: () => void
  onToggleSubtitles: () => void
  onSetPlaybackRate: (rate: PlaybackRate) => void
  onSetAmbientVolume: (volume: number) => void
  onSetVoiceVolume: (volume: number) => void
  onRestartChapter: () => void
  onOpenAbout: () => void
  onAdvance: () => void
  onPlayTerm: (
    term: StoryTerm,
    rate?: number,
    manual?: boolean,
  ) => Promise<AudioPlaybackResult>
  onExplain: (term: StoryTerm) => Promise<AudioPlaybackResult>
  onOpenMeaning: () => void
  onCloseMeaning: () => void
  onRestore: (termId: string) => void
  onSaveClip: (term: StoryTerm, clip: VoiceClip) => void
  onMicPermission: (permission: MicPermission) => void
  onChoice: (choice: Choice) => void
}

const followStatusCopy = {
  idle: '最长 5 秒 · 松开结束',
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
  audioPaused,
  subtitleVisible,
  translationOpen,
  restoredTermIds,
  skippedTermIds,
  explainedTermIds,
  reducedMotion,
  playbackRate,
  ambientVolume,
  voiceVolume,
  onToggleAudio,
  onTogglePause,
  onToggleSubtitles,
  onSetPlaybackRate,
  onSetAmbientVolume,
  onSetVoiceVolume,
  onRestartChapter,
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
  const [speaking, setSpeaking] = useState(false)
  const [speakingDuration, setSpeakingDuration] = useState(6800)
  const [speakingTick, setSpeakingTick] = useState(0)
  const [departingTermId, setDepartingTermId] = useState<string | null>(null)
  const [quickCapture, setQuickCapture] = useState(false)
  const termRef = useRef(term)
  const playedRef = useRef('')
  const exitTimerRef = useRef<number | null>(null)
  const playbackRequestRef = useRef(0)
  const meaningButtonRef = useRef<HTMLButtonElement>(null)
  const isCooling = chapter.scene === 'cooling'
  const isRestored = restoredTermIds.includes(term.id)
  const isExplained = explainedTermIds.includes(term.id)
  const isSkipped = skippedTermIds.includes(term.id)
  const isDeparting = departingTermId === term.id

  const mic = useMicRecorder({
    onPermission: onMicPermission,
    onClip: (clip) => {
      const activeTerm = termRef.current
      onRestore(activeTerm.id)
      onChoice({ scene: chapter.scene, type: 'save', termId: activeTerm.id })
      onSaveClip(activeTerm, clip)
    },
  })
  const micIsActive = mic.isActive
  const micStopHold = mic.stopHold

  const markSpeaking = useCallback((duration = 6800) => {
    setSpeakingDuration(reducedMotion ? Math.min(duration, 2800) : duration)
    setSpeaking(true)
    setSpeakingTick((value) => value + 1)
  }, [reducedMotion])

  useEffect(() => {
    if (!speaking) return
    const timer = window.setTimeout(() => setSpeaking(false), speakingDuration)
    return () => window.clearTimeout(timer)
  }, [speaking, speakingDuration, speakingTick])

  useEffect(() => {
    termRef.current = term
    if (audioMuted || audioPaused) return
    if (playedRef.current === term.id) return
    playedRef.current = term.id
    const requestId = ++playbackRequestRef.current
    markSpeaking(6800 / playbackRate)
    void onPlayTerm(term, (term.voiceRate ?? 1) * playbackRate, false).then(
      (result) => {
        if (
          requestId === playbackRequestRef.current &&
          result.durationMs > 0
        ) {
          markSpeaking(result.durationMs + 180)
        }
      },
    )
  }, [audioMuted, audioPaused, markSpeaking, onPlayTerm, playbackRate, term])


  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
    }
  }, [])

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
  const replay = () => {
    onChoice({ scene: chapter.scene, type: 'replay', termId: term.id })
    setPulse((value) => value + 1)
    const requestId = ++playbackRequestRef.current
    markSpeaking(6800 / playbackRate)
    void onPlayTerm(term, (term.voiceRate ?? 1) * playbackRate, true).then(
      (result) => {
        if (
          requestId === playbackRequestRef.current &&
          result.durationMs > 0
        ) {
          markSpeaking(result.durationMs + 180)
        }
      },
    )
  }

  const explain = () => {
    onChoice({ scene: chapter.scene, type: 'explain', termId: term.id })
    setPulse((value) => value + 1)
    const requestId = ++playbackRequestRef.current
    markSpeaking(9000 / playbackRate)
    onRestore(term.id)
    void onExplain(term).then((result) => {
      if (
        requestId === playbackRequestRef.current &&
        result.durationMs > 0
      ) {
        markSpeaking(result.durationMs + 180)
      }
    })
  }

  const openMeaning = () => {
    onChoice({ scene: chapter.scene, type: 'meaning', termId: term.id })
    onOpenMeaning()
  }

  const closeMeaning = useCallback(() => {
    onCloseMeaning()
    window.requestAnimationFrame(() => meaningButtonRef.current?.focus())
  }, [onCloseMeaning])

  const leaveWithChoice = (type: 'skip' | 'pretend') => {
    onChoice({ scene: chapter.scene, type, termId: term.id })
    setDepartingTermId(term.id)
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
    exitTimerRef.current = window.setTimeout(
      () => {
        setDepartingTermId(null)
        onAdvance()
      },
      reducedMotion ? 120 : 620,
    )
  }

  const beginFollow = () => {
    void mic.startHold()
  }

  const startQuickCapture = () => {
    if (mic.isActive) return
    setQuickCapture(true)
    void mic.startHold()
  }

  useEffect(() => {
    if (!quickCapture || !micIsActive) return
    const timer = window.setTimeout(() => {
      if (micIsActive) {
        onRestore(termRef.current.id)
        onChoice({ scene: chapter.scene, type: 'follow', termId: termRef.current.id })
      }
      micStopHold()
      setQuickCapture(false)
    }, 2800)
    return () => window.clearTimeout(timer)
  }, [chapter.scene, micIsActive, micStopHold, onChoice, onRestore, quickCapture])

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
  const textState = mic.isActive
    ? '你的笔画正在接入'
    : audioPaused
      ? '声音暂停 · 文字停在原处'
      : isSkipped
      ? '没有追问 · 字停在碎裂里'
      : isExplained
        ? '补充解释 · 部分复原'
        : isRestored
          ? '部分复原 · 仍有错位'
          : speaking
            ? '完整 · 受力 · 裂纹'
            : '完整 · 裂纹 · 碎裂 · 悬停'
  return (
    <main
      className={`story-scene story-scene--${chapter.scene}`}
      style={{ '--voice-level': audioLevel } as React.CSSProperties}
    >
      <PhoneChrome
        timer={timer}
        stage={chapter.stage}
        audioMuted={audioMuted}
        audioPaused={audioPaused}
        subtitleVisible={subtitleVisible}
        playbackRate={playbackRate}
        ambientVolume={ambientVolume}
        voiceVolume={voiceVolume}
        showChapterRestart
        onToggleAudio={onToggleAudio}
        onTogglePause={onTogglePause}
        onToggleSubtitles={onToggleSubtitles}
        onSetPlaybackRate={onSetPlaybackRate}
        onSetAmbientVolume={onSetAmbientVolume}
        onSetVoiceVolume={onSetVoiceVolume}
        onRestartChapter={onRestartChapter}
        onOpenAbout={onOpenAbout}
      />

      <section className="story-field" aria-labelledby="story-term-label">
        <div className="field-meta">
          <span className="speaker-mark" aria-hidden="true" />
          <span id="story-term-label">母亲的声音</span>
          <span className="field-meta__state" aria-live="polite">
            {textState}
          </span>
        </div>

        <SoundTextCanvas
          text={term.display}
          stateKey={term.id}
          replayToken={pulse}
          audioLevel={audioLevel}
          restoration={Math.max(mic.energy, isRestored ? 0.32 : 0)}
          reducedMotion={reducedMotion}
          speaking={speaking && !audioPaused && !audioMuted}
          restored={isRestored}
          fragmentBias={isDeparting ? 0.55 : 0}
          chapter={chapter.scene}
          fractureMode="voice"
          labelPrefix="母亲的话"
        />

        <div className="sound-rail" aria-hidden="true">
          <span />
        </div>

        <p className="chapter-note" aria-live="polite">
          {termIndex === 0 ? chapter.opening : chapter.chapterNote}
        </p>
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
          {isExplained && (
            <p className="explanation-trace" aria-live="polite">
              <span>母亲又说</span>
              {term.supplement}
            </p>
          )}

          <div className="action-row">
            <button type="button" className="quiet-button" onClick={replay}>
              再听一遍
            </button>
            <button type="button" className="quiet-button" onClick={explain}>
              请母亲解释
            </button>
            <button
              ref={meaningButtonRef}
              type="button"
              className="quiet-button"
              onClick={openMeaning}
            >
              查看意思
            </button>
            {isCooling && (
              <button
                type="button"
                className="quiet-button"
                onClick={() => leaveWithChoice('pretend')}
              >
                装作听懂
              </button>
            )}
            <button
              type="button"
              className="quiet-button"
              onClick={() => leaveWithChoice('skip')}
            >
              先跳过
            </button>
            <button
              type="button"
              className="primary-button primary-button--small"
              onClick={onAdvance}
              disabled={isDeparting}
            >
              {nextLabel}
            </button>
          </div>
          <p className="sr-only" aria-live="polite">
            {isDeparting ? '这一句正在留在身后。' : ''}
          </p>
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
            <button
              type="button"
              className="quick-record-button"
              onClick={startQuickCapture}
              disabled={mic.isActive}
              aria-pressed={quickCapture}
            >
              {quickCapture ? '正在录下这一句' : '录下这句话'}
            </button>
            <p id="follow-help" className="follow-panel__status" aria-live="polite">
              {followCopy}
            </p>
            <p className="follow-panel__privacy">
              按音量、起音、持续时间与节奏驱动文字；不识别、不评分、不上传。
            </p>
          </section>
        )}
      </footer>

      {translationOpen && (
        <MeaningDrawer term={term} explained={isExplained} onClose={closeMeaning} />
      )}
    </main>
  )
}