import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { NarrativeAudio } from './audio/NarrativeAudio'
import { GLASS_TIMING } from './config/glassTiming'
import { AboutScene } from './components/AboutScene'
import { EndingScene } from './components/EndingScene'
import { IntroScene } from './components/IntroScene'
import { PrologueScene } from './components/PrologueScene'
import { StoryScene } from './components/StoryScene'
import { TransitionScene } from './components/TransitionScene'
import { getChapter } from './content/scenes'
import { allTerms } from './content/terms'
import { themeStyle } from './data/theme'
import { useCallTimer } from './hooks/useCallTimer'
import { useReducedMotion } from './hooks/useReducedMotion'
import type { VoiceClip } from './hooks/useMicRecorder'
import type {
  AudioPlaybackResult,
  Choice,
  MicPermission,
  PlaybackRate,
  RecordedFragment,
  RestorationSource,
  Scene,
  StoryScene as StorySceneName,
  StoryTerm,
} from './types'

const isStoryScene = (scene: Scene): scene is StorySceneName =>
  scene === 'call' || scene === 'stove' || scene === 'cooling'

const isPhoneActive = (scene: Scene) =>
  scene === 'call' ||
  scene === 'stove' ||
  scene === 'transition' ||
  scene === 'cooling' ||
  scene === 'ending'

const addUnique = (values: string[], value: string) =>
  values.includes(value) ? values : [...values, value]

const restorationPriority: Record<RestorationSource, number> = {
  semantic: 1,
  rhythm: 2,
  voice: 3,
}

interface AboutReturn {
  scene: StorySceneName
  termIndex: number
}

type TransitionTarget = 'cooling' | 'ending'

function App() {
  const [audio] = useState(() => new NarrativeAudio())

  const [scene, setScene] = useState<Scene>('prologue')
  const [transitionTarget, setTransitionTarget] = useState<TransitionTarget>('cooling')
  const [introHasPlayed, setIntroHasPlayed] = useState(false)
  const [termIndex, setTermIndex] = useState(0)
  const [chapterRun, setChapterRun] = useState(0)
  const [audioMuted, setAudioMuted] = useState(false)
  const [audioPaused, setAudioPaused] = useState(false)
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1)
  const [ambientVolume, setAmbientVolume] = useState(0.74)
  const [voiceVolume, setVoiceVolume] = useState(0.9)
  const [subtitleVisible, setSubtitleVisible] = useState(false)
  const [translationOpen, setTranslationOpen] = useState(false)
  const [micPermission, setMicPermission] = useState<MicPermission>('unknown')
  const [restoredTermSources, setRestoredTermSources] = useState<
    Record<string, RestorationSource>
  >({})
  const [rhythmTermIds, setRhythmTermIds] = useState<string[]>([])
  const [skippedTermIds, setSkippedTermIds] = useState<string[]>([])
  const [inspectedTermIds, setInspectedTermIds] = useState<string[]>([])
  const [callGuideVisible, setCallGuideVisible] = useState(false)
  const [soundGuideVisible, setSoundGuideVisible] = useState(false)
  const [explainedTermIds, setExplainedTermIds] = useState<string[]>([])
  const [recordedFragments, setRecordedFragments] = useState<RecordedFragment[]>([])
  const [choices, setChoices] = useState<Choice[]>([])
  const [audioLevel, setAudioLevel] = useState(0)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [aboutReturn, setAboutReturn] = useState<AboutReturn | null>(null)
  const fragmentUrlsRef = useRef<string[]>([])
  const duckReasonsRef = useRef(new Set<string>())
  const duckTimersRef = useRef(new Map<string, number>())
  const reducedMotion = useReducedMotion()
  const callTimer = useCallTimer(isPhoneActive(scene) && audioUnlocked)
  const chapter = isStoryScene(scene) ? getChapter(scene) : null

  const resetFragmentUrls = useCallback(() => {
    fragmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    fragmentUrlsRef.current = []
  }, [])

  const clearDuckTimers = useCallback(() => {
    duckTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    duckTimersRef.current.clear()
    duckReasonsRef.current.clear()
    audio.setAmbientDucked(false)
  }, [audio])

  const duckFor = useCallback(
    (reason: string, enabled: boolean) => {
      if (enabled) duckReasonsRef.current.add(reason)
      else duckReasonsRef.current.delete(reason)
      audio.setAmbientDucked(duckReasonsRef.current.size > 0)
    },
    [audio],
  )

  const duckTemporarily = useCallback(
    (reason: string, duration: number) => {
      const existing = duckTimersRef.current.get(reason)
      if (existing) window.clearTimeout(existing)
      duckFor(reason, true)
      const timer = window.setTimeout(() => {
        duckTimersRef.current.delete(reason)
        duckFor(reason, false)
      }, duration)
      duckTimersRef.current.set(reason, timer)
    },
    [duckFor],
  )

  const markIntroComplete = useCallback(() => {
    setIntroHasPlayed(true)
  }, [])

  const beginPrologue = useCallback(() => {
    setAudioMuted(false)
    setAudioPaused(false)
    audio.setPaused(false)
    audio.setMuted(false)
    setAudioLevel(0)
    void audio.unlock().then((unlocked) => {
      setAudioUnlocked(unlocked)
    })
  }, [audio])

  const finishPrologue = useCallback(() => {
    setScene('intro')
  }, [])

  const startStory = useCallback(async () => {
    setIntroHasPlayed(true)
    setAudioMuted(false)
    setAudioPaused(false)
    audio.setPaused(false)
    audio.setMuted(false)
    setAudioLevel(0)
    await audio.unlock()
    setAudioUnlocked(true)
    setScene('call')
    setTransitionTarget('cooling')
    setCallGuideVisible(true)
    setSoundGuideVisible(false)
    setTermIndex(0)
    setChapterRun((value) => value + 1)
    setTranslationOpen(false)
    setRestoredTermSources({})
    clearDuckTimers()
  }, [audio, clearDuckTimers])

  const goHome = useCallback(() => {
    audio.stopVoice()
    audio.stopAmbient()
    resetFragmentUrls()
    clearDuckTimers()
    setAudioLevel(0)
    setScene('intro')
    setTransitionTarget('cooling')
    setTermIndex(0)
    setChapterRun(0)
    setTranslationOpen(false)
    setSubtitleVisible(false)
    setAudioPaused(false)
    setRestoredTermSources({})
    setRhythmTermIds([])
    setSkippedTermIds([])
    setExplainedTermIds([])
    setInspectedTermIds([])
    setCallGuideVisible(false)
    setSoundGuideVisible(false)
    setRecordedFragments([])
    setChoices([])
    setAboutReturn(null)
    setAudioUnlocked(false)
    callTimer.reset()
  }, [audio, callTimer, clearDuckTimers, resetFragmentUrls])

  const restart = useCallback(async () => {
    audio.stopVoice()
    resetFragmentUrls()
    clearDuckTimers()
    setRestoredTermSources({})
    setRhythmTermIds([])
    setSkippedTermIds([])
    setExplainedTermIds([])
    setInspectedTermIds([])
    setCallGuideVisible(false)
    setSoundGuideVisible(false)
    setRecordedFragments([])
    setChoices([])
    setMicPermission('unknown')
    setAboutReturn(null)
    setSubtitleVisible(false)
    setAudioPaused(false)
    setChapterRun((value) => value + 1)
    callTimer.reset()
    setAudioMuted(false)
    await audio.unlock()
    setAudioLevel(0)
    setAudioUnlocked(true)
    setScene('call')
    setCallGuideVisible(true)
    setTermIndex(0)
    setTranslationOpen(false)
    setRestoredTermSources({})
  }, [audio, callTimer, clearDuckTimers, resetFragmentUrls])

  const dismissCallGuide = useCallback(() => setCallGuideVisible(false), [])
  const dismissSoundGuide = useCallback(() => setSoundGuideVisible(false), [])

  const openAbout = useCallback(() => {
    if (isStoryScene(scene)) setAboutReturn({ scene, termIndex })
    else setAboutReturn(null)
    audio.stopVoice()
    clearDuckTimers()
    setTranslationOpen(false)
    setCallGuideVisible(false)
    setSoundGuideVisible(false)
    setScene('about')
  }, [audio, clearDuckTimers, scene, termIndex])

  const returnFromAbout = useCallback(() => {
    if (!aboutReturn) return
    setScene(aboutReturn.scene)
    setTermIndex(aboutReturn.termIndex)
    setChapterRun((value) => value + 1)
    setAboutReturn(null)
  }, [aboutReturn])

  const toggleAudio = useCallback(() => {
    setAudioMuted((muted) => {
      const next = !muted
      audio.setMuted(next)
      return next
    })
  }, [audio])

  const togglePause = useCallback(() => {
    setAudioPaused((paused) => {
      const next = !paused
      audio.setPaused(next)
      return next
    })
  }, [audio])
  const toggleSubtitles = useCallback(() => setSubtitleVisible((visible) => !visible), [])

  const choose = useCallback((choice: Choice) => {
    setChoices((previous) => [...previous, choice])
    if (!choice.termId) return
    if (choice.type === 'skip' || choice.type === 'pretend') {
      setSkippedTermIds((previous) => addUnique(previous, choice.termId!))
    }
    if (choice.type === 'explain') {
      setExplainedTermIds((previous) => addUnique(previous, choice.termId!))
    }
    if (choice.type === 'meaning') {
      setInspectedTermIds((previous) => addUnique(previous, choice.termId!))
    }
  }, [])

  const restore = useCallback(
    (termId: string, source: RestorationSource) => {
      if (source === 'rhythm') {
        setRhythmTermIds((previous) => addUnique(previous, termId))
      }
      setRestoredTermSources((previous) => {
        const existing = previous[termId]
        if (
          existing &&
          restorationPriority[existing] >= restorationPriority[source]
        ) {
          return previous
        }
        return { ...previous, [termId]: source }
      })
    },
    [],
  )


  const getVoicePlayback = useCallback(
    () => audio.getVoicePlayback(),
    [audio],
  )

  const changePlaybackRate = useCallback(
    (rate: PlaybackRate) => {
      setPlaybackRate(rate)
      audio.setVoicePlaybackRate(rate)
    },
    [audio],
  )

  const setFollowListening = useCallback(
    (active: boolean) => audio.setInteractionPaused(active),
    [audio],
  )

  const playTerm = useCallback(
    async (
      term: StoryTerm,
      rate = 1,
      manual = false,
    ): Promise<AudioPlaybackResult> => {
      if (!audioUnlocked) return { kind: 'placeholder', durationMs: 0 }
      if (audioPaused) {
        if (!manual) return { kind: 'placeholder', durationMs: 0 }
        setAudioPaused(false)
        audio.setPaused(false)
      }
      duckTemporarily('voice', 7600)
      const result = await audio.playTerm(
        term,
        rate,
        manual ? GLASS_TIMING.replay.recombineMs / 1000 : 0,
      )
      if (result.durationMs > 0) {
        duckTemporarily('voice', result.durationMs + 450)
      }
      return result
    },
    [audio, audioPaused, audioUnlocked, duckTemporarily],
  )

  const explainTerm = useCallback(
    async (term: StoryTerm): Promise<AudioPlaybackResult> => {
      if (!audioUnlocked) return { kind: 'placeholder', durationMs: 0 }
      if (audioPaused) {
        setAudioPaused(false)
        audio.setPaused(false)
      }
      duckTemporarily('explain', 10000)
      const result = await audio.playSupplement(
        term,
        (term.voiceRate ?? 1) * playbackRate,
        GLASS_TIMING.replay.recombineMs / 1000,
      )
      if (result.durationMs > 0) {
        duckTemporarily('explain', result.durationMs + 450)
      }
      return result
    },
    [audio, audioPaused, audioUnlocked, duckTemporarily, playbackRate],
  )

  const openMeaning = useCallback(() => {
    setTranslationOpen(true)
    duckFor('meaning', true)
  }, [duckFor])

  const closeMeaning = useCallback(() => {
    setTranslationOpen(false)
    duckFor('meaning', false)
  }, [duckFor])

  const advance = useCallback(() => {
    if (!chapter) return
    audio.stopVoice()
    clearDuckTimers()
    setTranslationOpen(false)
    if (termIndex < chapter.terms.length - 1) {
      setTermIndex((index) => index + 1)
      return
    }
    if (chapter.scene === 'stove') {
      setTransitionTarget('cooling')
      setScene('transition')
    } else if (chapter.scene === 'cooling') {
      setTransitionTarget('ending')
      setScene('transition')
    } else {
      setScene(chapter.nextScene)
    }
    setTermIndex(0)
    setChapterRun((value) => value + 1)
  }, [audio, chapter, clearDuckTimers, termIndex])

  const restartChapter = useCallback(() => {
    if (!chapter) return
    const chapterTermIds = new Set(chapter.terms.map((term) => term.id))
    audio.stopVoice()
    clearDuckTimers()
    setTermIndex(0)
    setChapterRun((value) => value + 1)
    setTranslationOpen(false)
    setAudioPaused(false)
    setRhythmTermIds((previous) => previous.filter((id) => !chapterTermIds.has(id)))
    setRestoredTermSources((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([id]) => !chapterTermIds.has(id)),
      ) as Record<string, RestorationSource>,
    )
    setSkippedTermIds((previous) => previous.filter((id) => !chapterTermIds.has(id)))
    setExplainedTermIds((previous) => previous.filter((id) => !chapterTermIds.has(id)))
    setInspectedTermIds((previous) => previous.filter((id) => !chapterTermIds.has(id)))
    setChoices((previous) => previous.filter((choice) => choice.scene !== chapter.scene))
  }, [audio, chapter, clearDuckTimers])

  const saveClip = useCallback((term: StoryTerm, clip: VoiceClip) => {
    const sceneLabel = term.scene === 'cooling' ? '纳凉' : term.scene === 'stove' ? '灶台' : '电话'
    const fragment: RecordedFragment = {
      id: `${term.id}-${clip.createdAt}`,
      scene: term.scene,
      termId: term.id,
      label: term.display,
      source: `${sceneLabel} · ${term.beat}`,
      duration: clip.duration,
      createdAt: clip.createdAt,
      url: clip.url,
    }
    fragmentUrlsRef.current.push(clip.url)
    setRecordedFragments((previous) => [...previous, fragment])
  }, [])
  useEffect(() => {
    audio.setMuted(audioMuted)
  }, [audio, audioMuted])

  useEffect(() => {
    audio.setPaused(audioPaused)
  }, [audio, audioPaused])

  useEffect(() => {
    audio.setAmbientVolume(ambientVolume)
  }, [ambientVolume, audio])

  useEffect(() => {
    audio.setVoiceVolume(voiceVolume)
  }, [audio, voiceVolume])

  useEffect(() => {
    if (!audioUnlocked) return

    if (scene === 'prologue' || scene === 'intro' || scene === 'call')
      audio.setAmbient('phone', getChapter('call').ambientSrc, 0.7)
    else if (scene === 'stove')
      audio.setAmbient('kitchen', getChapter('stove').ambientSrc, 1.8)
    else if (scene === 'transition') {
      if (transitionTarget === 'ending')
        audio.setAmbient('phone', getChapter('call').ambientSrc, 2.2)
      else audio.setAmbient('night', getChapter('cooling').ambientSrc, 2.2)
    } else if (scene === 'cooling')
      audio.setAmbient('night', getChapter('cooling').ambientSrc, 1.1)
    else if (scene === 'ending')
      audio.setAmbient('phone', getChapter('call').ambientSrc, 1.6)
    else audio.setAmbient('none')

    return () => {
      if (scene === 'about') audio.stopAmbient()
    }
  }, [audio, audioUnlocked, scene, transitionTarget])

  useEffect(() => {
    if (!audioUnlocked) return
    let frame = 0
    let lastUpdate = 0
    const readLevel = (now: number) => {
      if (now - lastUpdate > 45) {
        setAudioLevel(audio.getLevel())
        lastUpdate = now
      }
      frame = requestAnimationFrame(readLevel)
    }
    frame = requestAnimationFrame(readLevel)
    return () => cancelAnimationFrame(frame)
  }, [audio, audioUnlocked])

  useEffect(() => {
    const handleVisibility = () => audio.pauseForVisibility(document.hidden)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [audio])

  useEffect(() => {
    const timers = duckTimersRef.current
    return () => {
      void audio.close()
      resetFragmentUrls()
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.clear()
    }
  }, [audio, resetFragmentUrls])

  const completeTransition = useCallback(() => {
    if (transitionTarget === 'ending') {
      setSoundGuideVisible(false)
    } else {
      setSoundGuideVisible(true)
    }
    setScene(transitionTarget === 'ending' ? 'ending' : 'cooling')
    setTermIndex(0)
    setChapterRun((value) => value + 1)
  }, [transitionTarget])

  const openArchiveFromEnding = useCallback(() => {
    audio.stopVoice()
    clearDuckTimers()
    setAboutReturn(null)
    setScene('about')
  }, [audio, clearDuckTimers])

  const touchedTermIds = new Set(
    choices
      .map((choice) => choice.termId)
      .filter((termId): termId is string => Boolean(termId)),
  )
  const pathSummary = {
    replayed: choices.filter((choice) => choice.type === 'replay').length,
    explained: choices.filter((choice) => choice.type === 'explain').length,
    inspected: inspectedTermIds.length,
    skipped: choices.filter(
      (choice) => choice.type === 'skip' || choice.type === 'pretend',
    ).length,
    followed: choices.filter(
      (choice) => choice.type === 'follow' || choice.type === 'save',
    ).length,
    untouched: Math.max(0, allTerms.length - touchedTermIds.size),
  }

  const sharedPhoneProps = {
    timer: callTimer.label,
    audioLevel: audioUnlocked ? audioLevel : 0,
    audioMuted,
    audioPaused,
    subtitleVisible,
    reducedMotion,
    playbackRate,
    ambientVolume,
    voiceVolume,
    onToggleAudio: toggleAudio,
    onTogglePause: togglePause,
    onToggleSubtitles: toggleSubtitles,
    onSetPlaybackRate: changePlaybackRate,
    onSetAmbientVolume: setAmbientVolume,
    onSetVoiceVolume: setVoiceVolume,
    onOpenAbout: openAbout,
  }

  return (
    <div
      className="experience"
      style={themeStyle}
      data-scene={scene}
      data-choice-count={choices.length}
      data-mic-permission={micPermission}
      data-audio-state={audioPaused ? 'paused' : audioMuted ? 'muted' : 'playing'}
      data-translation-open={translationOpen}
    >
      {scene === 'prologue' && (
        <PrologueScene onBegin={beginPrologue} onComplete={finishPrologue} />
      )}

      {scene === 'intro' && (
        <IntroScene
          animateIntro={!introHasPlayed}
          reducedMotion={reducedMotion}
          onStart={() => void startStory()}
          onIntroComplete={markIntroComplete}
          onOpenAbout={openAbout}
        />
      )}

      {chapter && (
        <StoryScene
          key={`${chapter.scene}-${chapterRun}`}
          {...sharedPhoneProps}
          chapter={chapter}
          termIndex={termIndex}
          translationOpen={translationOpen}
          restoredTermSource={restoredTermSources[chapter.terms[termIndex].id]}
          skippedTermIds={skippedTermIds}
          explainedTermIds={explainedTermIds}
          getVoicePlayback={getVoicePlayback}
          onFollowActiveChange={setFollowListening}
          onRestartChapter={restartChapter}
          onAdvance={advance}
          onPlayTerm={playTerm}
          onExplain={explainTerm}
          onOpenMeaning={openMeaning}
          onCloseMeaning={closeMeaning}
          onRestore={restore}
          onSaveClip={saveClip}
          onMicPermission={setMicPermission}
          onChoice={choose}
          callGuideVisible={callGuideVisible}
          soundGuideVisible={soundGuideVisible}
          onDismissCallGuide={dismissCallGuide}
          onDismissSoundGuide={dismissSoundGuide}
        />
      )}

      {scene === 'transition' && (
        <TransitionScene
          direction={transitionTarget === 'ending' ? 'reality' : 'memory'}
          audioLevel={audioUnlocked ? audioLevel : 0}
          reducedMotion={reducedMotion}
          onComplete={completeTransition}
        />
      )}

      {scene === 'ending' && (
        <EndingScene
          {...sharedPhoneProps}
          restoredTermSources={restoredTermSources}
          onComplete={openArchiveFromEnding}
        />
      )}

      {scene === 'about' && (
        <AboutScene
          fragments={recordedFragments}
          rhythmRestoredCount={rhythmTermIds.length}
          pathSummary={pathSummary}
          canReturn={aboutReturn !== null}
          onReturn={returnFromAbout}
          onRestart={() => void restart()}
          onHome={goHome}
        />
      )}
    </div>
  )
}

export default App