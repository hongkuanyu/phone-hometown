import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AudioPlaybackResult,
  Choice,
  MicPermission,
  PlaybackRate,
  RestorationSource,
  StoryChapter,
  StoryTerm,
  VoicePlaybackSnapshot,
} from '../types'
import { useMicRecorder } from '../hooks/useMicRecorder'
import type { FollowOutcome, VoiceClip } from '../hooks/useMicRecorder'
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
  restoredTermSource?: RestorationSource
  skippedTermIds: string[]
  explainedTermIds: string[]
  reducedMotion: boolean
  playbackRate: PlaybackRate
  ambientVolume: number
  voiceVolume: number
  getVoicePlayback: () => VoicePlaybackSnapshot
  onFollowActiveChange: (active: boolean) => void
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
  onRestore: (termId: string, source: RestorationSource) => void
  onSaveClip: (term: StoryTerm, clip: VoiceClip) => void
  onMicPermission: (permission: MicPermission) => void
  onChoice: (choice: Choice) => void
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
  restoredTermSource,
  skippedTermIds,
  explainedTermIds,
  reducedMotion,
  playbackRate,
  ambientVolume,
  voiceVolume,
  getVoicePlayback,
  onFollowActiveChange,
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
  const [followFeedback, setFollowFeedback] = useState<{
    kind: 'voice' | 'rhythm' | 'silent'
    text: string
  } | null>(null)
  const [playbackInfo, setPlaybackInfo] = useState<{
    termId: string
    kind: 'recording' | 'placeholder'
  } | null>(null)
  const [helperReadyFor, setHelperReadyFor] = useState<string | null>(null)
  const [helperOpenFor, setHelperOpenFor] = useState<string | null>(null)
  const [coolingAssistReadyFor, setCoolingAssistReadyFor] = useState<string | null>(null)
  const playbackKind =
    playbackInfo?.termId === term.id ? playbackInfo.kind : null
  const playbackReadyForTerm = playbackInfo?.termId === term.id
  const termRef = useRef(term)
  const playedRef = useRef('')
  const followPointerActiveRef = useRef(false)
  const playbackRequestRef = useRef(0)
  const meaningButtonRef = useRef<HTMLButtonElement>(null)
  const meaningOriginRef = useRef<'button' | 'term'>('button')
  const feedbackTimerRef = useRef<number | null>(null)
  const isCooling = chapter.scene === 'cooling'
  const isCall = chapter.scene === 'call'
  const isFinalCooling = isCooling && termIndex === chapter.terms.length - 1
  const helperReady = helperReadyFor === term.id
  const helperOpen = helperOpenFor === term.id
  const coolingAssistReady =
    isCooling && !isFinalCooling && coolingAssistReadyFor === term.id
  const isRestored = Boolean(restoredTermSource)
  const isExplained = explainedTermIds.includes(term.id)
  const isSkipped = skippedTermIds.includes(term.id)

  const showFollowFeedback = useCallback(
    (outcome: FollowOutcome) => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current)
      }
      const feedback =
        outcome.source === 'voice'
          ? { kind: 'voice' as const, text: '你留下了一笔。' }
          : outcome.source === 'rhythm'
            ? { kind: 'rhythm' as const, text: '这次节奏留下了一笔。' }
            : {
                kind: 'silent' as const,
                text: '这次没有声音。也可以只是听。',
              }
      setFollowFeedback(feedback)
      feedbackTimerRef.current = window.setTimeout(
        () => setFollowFeedback(null),
        1800,
      )
    },
    [],
  )

  const mic = useMicRecorder({
    onPermission: onMicPermission,
    onComplete: (outcome) => {
      const activeTerm = termRef.current
      if (outcome.clip) onSaveClip(activeTerm, outcome.clip)
      if (outcome.source === 'voice') {
        onRestore(activeTerm.id, 'voice')
        onChoice({
          scene: chapter.scene,
          type: outcome.clip ? 'save' : 'follow',
          termId: activeTerm.id,
        })
      } else if (outcome.source === 'rhythm') {
        onRestore(activeTerm.id, 'rhythm')
        onChoice({ scene: chapter.scene, type: 'follow', termId: activeTerm.id })
      }
      showFollowFeedback(outcome)
      onFollowActiveChange(false)
    },
  })

  const cancelMicCapture = mic.cancelHold

  useEffect(() => {
    cancelMicCapture()
  }, [cancelMicCapture, term.id])

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
    if (isFinalCooling || speaking || audioPaused || audioMuted) return
    if (!playbackReadyForTerm) return
    const delay = isCall ? (termIndex === 0 ? 1400 : 900) : isCooling ? 1700 : 1100
    const timer = window.setTimeout(() => setHelperReadyFor(term.id), delay)
    return () => window.clearTimeout(timer)
  }, [
    audioMuted,
    audioPaused,
    isCall,
    isCooling,
    isFinalCooling,
    playbackReadyForTerm,
    speaking,
    term.id,
    termIndex,
  ])

  useEffect(() => {
    if (!isCooling || isFinalCooling || speaking || audioPaused) return
    if (!playbackReadyForTerm) return
    const timer = window.setTimeout(
      () => setCoolingAssistReadyFor(term.id),
      1900,
    )
    return () => window.clearTimeout(timer)
  }, [
    audioPaused,
    isCooling,
    isFinalCooling,
    playbackReadyForTerm,
    speaking,
    term.id,
  ])

  useEffect(() => {
    if (!isFinalCooling || speaking || audioPaused) return
    if (!playbackReadyForTerm) return
    const timer = window.setTimeout(
      onAdvance,
      reducedMotion ? 1600 : 4200,
    )
    return () => window.clearTimeout(timer)
  }, [
    audioPaused,
    isFinalCooling,
    onAdvance,
    playbackReadyForTerm,
    reducedMotion,
    speaking,
  ])

  useEffect(() => {
    termRef.current = term
    if (audioMuted) {
      // Muting stops the voice instance. Clear the guard so enabling sound
      // starts the current term again instead of leaving a silent final frame.
      playedRef.current = ''
      return
    }
    if (audioPaused) return
    if (playedRef.current === term.id) return
    playedRef.current = term.id
    const requestId = ++playbackRequestRef.current
    markSpeaking(6800 / playbackRate)
    void onPlayTerm(term, (term.voiceRate ?? 1) * playbackRate, false).then(
      (result) => {
        if (requestId === playbackRequestRef.current) {
          setPlaybackInfo({ termId: term.id, kind: result.kind })
        }
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
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current)
      }
      onFollowActiveChange(false)
    }
  }, [onFollowActiveChange])

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
      onFollowActiveChange(true)
      void mic.startHold()
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isInteractiveTarget(event.target)) return
      event.preventDefault()
      onFollowActiveChange(false)
      mic.stopHold()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [chapter.scene, isCooling, mic, onFollowActiveChange])
  const replay = () => {
    onChoice({ scene: chapter.scene, type: 'replay', termId: term.id })
    setPulse((value) => value + 1)
    const requestId = ++playbackRequestRef.current
    markSpeaking(6800 / playbackRate)
    void onPlayTerm(term, (term.voiceRate ?? 1) * playbackRate, true).then(
      (result) => {
        if (requestId === playbackRequestRef.current) {
          setPlaybackInfo({ termId: term.id, kind: result.kind })
        }
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
    onRestore(term.id, 'semantic')
    void onExplain(term).then((result) => {
      if (requestId === playbackRequestRef.current) {
        setPlaybackInfo({ termId: term.id, kind: result.kind })
      }
      if (
        requestId === playbackRequestRef.current &&
        result.durationMs > 0
      ) {
        markSpeaking(result.durationMs + 180)
      }
    })
  }

  const openMeaning = (origin: 'button' | 'term' = 'button') => {
    meaningOriginRef.current = origin
    onChoice({ scene: chapter.scene, type: 'meaning', termId: term.id })
    onRestore(term.id, 'semantic')
    onOpenMeaning()
  }

  const closeMeaning = useCallback(() => {
    onCloseMeaning()
    window.requestAnimationFrame(() => {
      if (meaningOriginRef.current === 'term') {
        document.querySelector<HTMLElement>('.sound-field__term-hitarea')?.focus()
      } else {
        meaningButtonRef.current?.focus()
      }
    })
  }, [onCloseMeaning])

  const beginFollow = () => {
    onFollowActiveChange(true)
    void mic.startHold()
  }

  const endFollow = () => {
    followPointerActiveRef.current = false
    onFollowActiveChange(false)
    mic.stopHold()
  }

  const handleFollowPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    followPointerActiveRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    beginFollow()
  }

  const handleFollowPointerMove = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (!followPointerActiveRef.current) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const edgeTolerance = 14
    const outside =
      event.clientX < bounds.left - edgeTolerance ||
      event.clientX > bounds.right + edgeTolerance ||
      event.clientY < bounds.top - edgeTolerance ||
      event.clientY > bounds.bottom + edgeTolerance
    if (outside) endFollow()
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

  const activeRestorationSource = mic.isActive
    ? mic.status === 'fallback'
      ? 'rhythm'
      : 'voice'
    : restoredTermSource
  const followCopy =
    followFeedback?.text ??
    (mic.status === 'requesting'
      ? '正在等待麦克风权限'
      : mic.status === 'recording' || mic.status === 'listening'
        ? mic.voiceDetected
          ? '你的声音正在留下这一笔'
          : '正在听你的声音'
        : mic.status === 'fallback'
          ? mic.permission === 'denied'
            ? '没有打开麦克风 · 用节奏留下一笔'
            : '没有使用麦克风 · 用节奏留下一笔'
          : mic.permission === 'denied' || mic.permission === 'unsupported'
            ? '也可以只是听 · 按住可用节奏补一笔'
            : mic.permission === 'granted'
              ? '仅本页 · 也可以只是听'
              : '按住后才会请求麦克风')
  const textState = mic.isActive
    ? mic.status === 'fallback'
      ? '节奏正在留下一笔'
      : mic.voiceDetected
        ? '你的声音正在留下这一笔'
        : '正在听你的声音'
    : audioPaused
      ? '声音暂停 · 文字停在原处'
      : isSkipped
        ? '没有追问 · 字停在碎裂里'
        : isExplained
          ? '补充解释 · 部分复原'
          : isRestored
            ? restoredTermSource === 'voice'
              ? '声音补回 · 仍有错位'
              : restoredTermSource === 'rhythm'
                ? '节奏补回 · 仍有错位'
                : '部分复原 · 仍有错位'
            : speaking && playbackKind === 'placeholder'
              ? '录音缺失 · 演示节奏'
              : speaking
                ? '完整 · 受力 · 裂纹'
                : '完整 · 裂纹 · 碎裂 · 悬停'
  return (
    <main
      className={`story-scene story-scene--${chapter.scene} ${isCall && termIndex === 0 ? 'story-scene--call-opening' : ''} ${isFinalCooling ? 'story-scene--final-memory' : ''}`}
      style={{ '--voice-level': audioLevel } as React.CSSProperties}
    >
      {(!isFinalCooling || audioPaused) && (
        <PhoneChrome
          timer={timer}
          stage={isCall ? chapter.stage : ''}
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
      )}

      <section className="story-field" aria-label="母亲的声音">
        {!isFinalCooling && (
          <div className="field-meta">
            <span className="speaker-mark" aria-hidden="true" />
            <span id="story-term-label">母亲的声音</span>
            <span className="field-meta__state" aria-live="polite">
              {textState}
            </span>
          </div>
        )}

        <SoundTextCanvas
          text={term.display}
          stateKey={term.id}
          replayToken={pulse}
          audioLevel={audioLevel}
          restoration={Math.max(
            mic.energy,
            isRestored
              ? restoredTermSource === 'voice'
                ? 0.42
                : restoredTermSource === 'rhythm'
                  ? 0.28
                  : 0.26
              : 0,
          )}
          reducedMotion={reducedMotion}
          speaking={speaking && !audioPaused && !audioMuted}
          restored={isRestored}
          restorationSource={activeRestorationSource}
          guideActive={false}
          onTermClick={isFinalCooling ? undefined : () => openMeaning('term')}
          fragmentBias={0}
          chapter={chapter.scene}
          fractureMode="voice"
          getVoicePlayback={getVoicePlayback}
          nextText={chapter.terms[termIndex + 1]?.display}
          labelPrefix="母亲的话"
        />

        {!isFinalCooling && (
          <div className="sound-rail" aria-hidden="true">
            <span />
          </div>
        )}

        {!isFinalCooling &&
          ((!isCall && termIndex === 0) || (isCall && termIndex > 0)) && (
            <p className="chapter-note" aria-live="polite">
              {termIndex === 0 ? chapter.opening : chapter.chapterNote}
            </p>
          )}
      </section>

      {!isFinalCooling && (
        <footer className="story-footer">
          <section className="cue-panel" aria-label="当前情境">
            <p className="cue-panel__beat">
              {isCall ? '来电' : term.beat}
            </p>
            {subtitleVisible && (
              <p className="subtitle-line">
                <span>普通话提示</span>
                {term.mandarinHint}
              </p>
            )}
            {subtitleVisible && isExplained && (
              <p className="explanation-trace" aria-live="polite">
                <span>母亲又说</span>
                {term.supplement}
              </p>
            )}

            <div
              className="action-dock"
              role="group"
              aria-label="当前这句话的操作"
            >
              <div className="sentence-assist">
                {helperReady && (
                  <>
                    <button
                      type="button"
                      className="sentence-helper-prompt"
                      onClick={() =>
                        setHelperOpenFor(helperOpen ? null : term.id)
                      }
                      aria-expanded={helperOpen}
                      aria-controls={`sentence-helper-${term.id}`}
                    >
                      没听清？
                    </button>
                    {helperOpen && (
                      <div
                        id={`sentence-helper-${term.id}`}
                        className="sentence-helper-tools"
                      >
                        <button
                          type="button"
                          className="quiet-button action-button--strong action-button--tool"
                          onClick={replay}
                          aria-label="再听一次这一句"
                        >
                          再听一次
                        </button>
                        <button
                          type="button"
                          className="quiet-button action-button--strong action-button--tool"
                          onClick={explain}
                          aria-label="没听清，再问母亲一句"
                        >
                          啊？
                        </button>
                        <button
                          ref={meaningButtonRef}
                          type="button"
                          className="quiet-button action-button--strong action-button--tool"
                          onClick={() => openMeaning('button')}
                          aria-label="看看这句话是什么意思"
                        >
                          看看是什么意思
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              <button
                type="button"
                className="primary-button action-button--advance"
                onClick={onAdvance}
              >
                继续听
                <span className="action-button__arrow" aria-hidden="true">→</span>
              </button>
            </div>
          </section>

          {coolingAssistReady && (
            <section
              className={`follow-panel ${mic.isActive ? 'is-active' : ''} ${
                followFeedback ? `feedback-${followFeedback.kind}` : ''
              }`}
              aria-label="留下声音"
            >
              <div className="follow-panel__intro">
                <p className="follow-panel__title">按住，留下声音</p>
                <p className="follow-panel__invitation">也可以只是听。</p>
              </div>
              <button
                type="button"
                className="hold-button"
                onPointerDown={handleFollowPointerDown}
                onPointerMove={handleFollowPointerMove}
                onPointerUp={handleFollowPointerUp}
                onPointerCancel={endFollow}
                onLostPointerCapture={endFollow}
                onKeyDown={handleFollowKeyDown}
                onKeyUp={handleFollowKeyUp}
                onContextMenu={(event) => event.preventDefault()}
                aria-describedby="follow-help"
              >
                <span className="hold-button__ring" aria-hidden="true" />
                {mic.permission === 'denied' || mic.permission === 'unsupported'
                  ? '按住，留下节奏'
                  : '按住，说给她听'}
              </button>
              <p id="follow-help" className="follow-panel__status" aria-live="polite">
                {followCopy}
              </p>
              <p className="follow-panel__privacy">
                不识别、不评分、不上传，只在当前页面使用。
              </p>
              {followFeedback?.kind === 'voice' && (
                <span className="follow-panel__trace" aria-hidden="true" />
              )}
            </section>
          )}
        </footer>
      )}

      {translationOpen && (
        <MeaningDrawer term={term} explained={isExplained} onClose={closeMeaning} />
      )}
    </main>
  )
}