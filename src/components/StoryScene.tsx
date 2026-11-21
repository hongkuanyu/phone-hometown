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
  wordGuideVisible: boolean
  followGuideVisible: boolean
  skippedTermIds: string[]
  explainedTermIds: string[]
  reducedMotion: boolean
  playbackRate: PlaybackRate
  ambientVolume: number
  voiceVolume: number
  getVoicePlayback: () => VoicePlaybackSnapshot
  onFollowActiveChange: (active: boolean) => void
  onDismissWordGuide: () => void
  onDismissFollowGuide: () => void
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

function SceneGuide({
  visible,
  text,
  onDismiss,
}: {
  visible: boolean
  text: string
  onDismiss: () => void
}) {
  const guideRef = useRef<HTMLDivElement>(null)
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false)

  useEffect(() => {
    if (!visible) return
    const node = guideRef.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setHasEnteredViewport(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasEnteredViewport(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible || !hasEnteredViewport) return
    const timer = window.setTimeout(onDismiss, 9000)
    return () => window.clearTimeout(timer)
  }, [hasEnteredViewport, onDismiss, visible])

  return (
    <div
      ref={guideRef}
      className={`scene-guide ${visible ? 'is-visible' : 'is-hidden'}`}
      aria-live="polite"
      aria-hidden={!visible}
    >
      <p>{visible ? text : '\u00a0'}</p>
    </div>
  )
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
  wordGuideVisible,
  followGuideVisible,
  skippedTermIds,
  explainedTermIds,
  reducedMotion,
  playbackRate,
  ambientVolume,
  voiceVolume,
  getVoicePlayback,
  onFollowActiveChange,
  onDismissWordGuide,
  onDismissFollowGuide,
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
  const playbackKind =
    playbackInfo?.termId === term.id ? playbackInfo.kind : null
  const termRef = useRef(term)
  const playedRef = useRef('')
  const followPointerActiveRef = useRef(false)
  const playbackRequestRef = useRef(0)
  const meaningButtonRef = useRef<HTMLButtonElement>(null)
  const meaningOriginRef = useRef<'button' | 'term'>('button')
  const feedbackTimerRef = useRef<number | null>(null)
  const isCooling = chapter.scene === 'cooling'
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
            ? { kind: 'rhythm' as const, text: '这次节奏补回了一笔。' }
            : {
                kind: 'silent' as const,
                text: '这次没有检测到声音。可以再按住试一次。',
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
      window.setTimeout(onDismissFollowGuide, 1800)
    },
  })

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
    onDismissWordGuide()
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
    onDismissWordGuide()
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
    onDismissWordGuide()
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

  const followGuideText =
    mic.permission === 'denied' || mic.permission === 'unsupported'
      ? '麦克风未启用：按住跟读，会用节奏补回一笔。'
      : '按住跟读，你留下的声音会补回一笔。'
  const guideText = wordGuideVisible && chapter.scene === 'call'
    ? '字会跟着声音碎开。听不清时，可以再听一遍、听她解释，或看看这句话的意思。'
    : ''
  const activeRestorationSource = mic.isActive
    ? mic.status === 'fallback'
      ? 'rhythm'
      : 'voice'
    : restoredTermSource
  const followCopy =
    followFeedback?.text ??
    (mic.status === 'requesting'
      ? '正在请求麦克风权限'
      : mic.status === 'recording' || mic.status === 'listening'
        ? mic.voiceDetected
          ? '你的笔画正在接入'
          : '正在听你的声音'
        : mic.status === 'fallback'
          ? mic.permission === 'denied'
            ? '麦克风未开启 · 节奏替代中'
            : '节奏替代模式 · 没有使用麦克风'
          : mic.permission === 'denied'
            ? '麦克风未开启 · 按住仍可用节奏补回'
            : '按住跟读 · 最长 5 秒')
  const textState = mic.isActive
    ? mic.status === 'fallback'
      ? '节奏正在补回'
      : mic.voiceDetected
        ? '你的笔画正在接入'
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
        <SceneGuide
          visible={Boolean(guideText)}
          text={guideText}
          onDismiss={onDismissWordGuide}
        />

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
          guideActive={wordGuideVisible && chapter.scene === 'call'}
          onTermClick={() => openMeaning('term')}
          fragmentBias={0}
          chapter={chapter.scene}
          fractureMode="voice"
          getVoicePlayback={getVoicePlayback}
          nextText={chapter.terms[termIndex + 1]?.display}
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

          <div
            className={`action-dock ${wordGuideVisible && chapter.scene === 'call' ? 'is-intro' : ''}`}
            role="group"
            aria-labelledby="sentence-actions-label"
          >
            <div className="action-dock__stay">
              <p id="sentence-actions-label" className="action-dock__label">
                还想在这一句停一会儿
              </p>
              <div className="action-row__secondary">
                <button
                  type="button"
                  className="quiet-button action-button--strong action-button--tool"
                  onClick={replay}
                  aria-label="再听一遍这一句"
                >
                  再听一遍
                </button>
                <button
                  type="button"
                  className="quiet-button action-button--strong action-button--tool"
                  onClick={explain}
                  aria-label="听母亲解释这一句"
                >
                  听她解释
                </button>
                <button
                  ref={meaningButtonRef}
                  type="button"
                  className="quiet-button action-button--strong action-button--tool"
                  onClick={() => openMeaning('button')}
                  aria-label="查看这句话在生活中的意思"
                >
                  看这句话的意思
                </button>
              </div>
            </div>
            <button
              type="button"
              className="primary-button action-button--advance"
              onClick={onAdvance}
            >
              继续通话
              <span className="action-button__arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        {isCooling && (
          <section
            className={`follow-panel ${mic.isActive ? 'is-active' : ''} ${
              followFeedback ? `feedback-${followFeedback.kind}` : ''
            }`}
          >
            <SceneGuide
              visible={followGuideVisible}
              text={followGuideText}
              onDismiss={onDismissFollowGuide}
            />
            <p className="follow-panel__title">按住跟读，补回一笔</p>
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
              按住跟读
            </button>
            <p id="follow-help" className="follow-panel__status" aria-live="polite">
              {followCopy}
            </p>
            <p className="follow-panel__privacy">
              不识别、不评分、不上传。录音只留在当前标签页。
            </p>
            {followFeedback?.kind === 'voice' && (
              <span className="follow-panel__trace" aria-hidden="true" />
            )}
          </section>
        )}
      </footer>

      {translationOpen && (
        <MeaningDrawer term={term} explained={isExplained} onClose={closeMeaning} />
      )}
    </main>
  )
}