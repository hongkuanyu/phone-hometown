import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { NarrativeAudio } from './audio/NarrativeAudio'
import { AboutScene } from './components/AboutScene'
import { EndingScene } from './components/EndingScene'
import { IntroScene } from './components/IntroScene'
import { StoryScene } from './components/StoryScene'
import { TransitionScene } from './components/TransitionScene'
import { getChapter } from './content/scenes'
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

interface AboutReturn {
  scene: StorySceneName
  termIndex: number
}

function App() {
  const [audio] = useState(() => new NarrativeAudio())

  const [scene, setScene] = useState<Scene>('intro')
  const [termIndex, setTermIndex] = useState(0)
  const [chapterRun, setChapterRun] = useState(0)
  const [audioMuted, setAudioMuted] = useState(false)
  const [audioPaused, setAudioPaused] = useState(false)
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1)
  const [ambientVolume, setAmbientVolume] = useState(0.58)
  const [voiceVolume, setVoiceVolume] = useState(0.9)
  const [subtitleVisible, setSubtitleVisible] = useState(false)
  const [translationOpen, setTranslationOpen] = useState(false)
  const [micPermission, setMicPermission] = useState<MicPermission>('unknown')
  const [restoredTermIds, setRestoredTermIds] = useState<string[]>([])
  const [skippedTermIds, setSkippedTermIds] = useState<string[]>([])
  const [explainedTermIds, setExplainedTermIds] = useState<string[]>([])
  const [inspectedTermIds, setInspectedTermIds] = useState<string[]>([])
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

  const startStory = useCallback(async () => {
    setAudioMuted(false)
    setAudioPaused(false)
    audio.setPaused(false)
    audio.setMuted(false)
    setAudioLevel(0)
    await audio.unlock()
    setAudioUnlocked(true)
    setScene('call')
    setTermIndex(0)
    setChapterRun((value) => value + 1)
    setTranslationOpen(false)
    clearDuckTimers()
  }, [audio, clearDuckTimers])

  const goHome = useCallback(() => {
    audio.stopVoice()
    audio.stopAmbient()
    resetFragmentUrls()
    clearDuckTimers()
    setAudioLevel(0)
    setScene('intro')
    setTermIndex(0)
    setChapterRun(0)
    setTranslationOpen(false)
    setSubtitleVisible(false)
    setAudioPaused(false)
    setRestoredTermIds([])
    setSkippedTermIds([])
    setExplainedTermIds([])
    setInspectedTermIds([])
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
    setRestoredTermIds([])
    setSkippedTermIds([])
    setExplainedTermIds([])
    setInspectedTermIds([])
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
    setTermIndex(0)
    setTranslationOpen(false)
  }, [audio, callTimer, clearDuckTimers, resetFragmentUrls])

  const openAbout = useCallback(() => {
    if (isStoryScene(scene)) setAboutReturn({ scene, termIndex })
    else setAboutReturn(null)
    audio.stopVoice()
    clearDuckTimers()
    setTranslationOpen(false)
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

  const restore = useCallback((termId: string) => {
    setRestoredTermIds((previous) => addUnique(previous, termId))
  }, [])

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
      const result = await audio.playTerm(term, rate)
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
    setScene(chapter.nextScene)
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
    setRestoredTermIds((previous) => previous.filter((id) => !chapterTermIds.has(id)))
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

    if (scene === 'call') audio.setAmbient('phone', getChapter('call').ambientSrc)
    else if (scene === 'stove') audio.setAmbient('kitchen', getChapter('stove').ambientSrc)
    else if (scene === 'transition') audio.setAmbient('night', getChapter('cooling').ambientSrc)
    else if (scene === 'cooling') audio.setAmbient('night', getChapter('cooling').ambientSrc)
    else if (scene === 'ending') audio.setAmbient('phone', getChapter('call').ambientSrc)
    else audio.setAmbient('none')

    return () => {
      if (scene === 'about' || scene === 'intro') audio.stopAmbient()
    }
  }, [audio, audioUnlocked, scene])

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

  const advanceToCooling = useCallback(() => {
    setScene('cooling')
    setTermIndex(0)
    setChapterRun((value) => value + 1)
  }, [])

  const openArchiveFromEnding = useCallback(() => {
    audio.stopVoice()
    clearDuckTimers()
    setAboutReturn(null)
    setScene('about')
  }, [audio, clearDuckTimers])

  const pathSummary = {
    replayed: choices.filter((choice) => choice.type === 'replay').length,
    explained: choices.filter((choice) => choice.type === 'explain').length,
    skipped: choices.filter(
      (choice) => choice.type === 'skip' || choice.type === 'pretend',
    ).length,
    followed: choices.filter(
      (choice) => choice.type === 'follow' || choice.type === 'save',
    ).length,
    inspected: choices.filter((choice) => choice.type === 'meaning').length,
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
    onSetPlaybackRate: setPlaybackRate,
    onSetAmbientVolume: setAmbientVolume,
    onSetVoiceVolume: setVoiceVolume,
    onOpenAbout: openAbout,
  }

  return (
    <div
      className="experience"
      style={themeStyle}
      data-choice-count={choices.length}
      data-mic-permission={micPermission}
      data-audio-state={audioPaused ? 'paused' : audioMuted ? 'muted' : 'playing'}
    >
      {scene === 'intro' && (
        <IntroScene onStart={() => void startStory()} onOpenAbout={openAbout} />
      )}

      {chapter && (
        <StoryScene
          key={`${chapter.scene}-${chapterRun}`}
          {...sharedPhoneProps}
          chapter={chapter}
          termIndex={termIndex}
          translationOpen={translationOpen}
          restoredTermIds={restoredTermIds}
          skippedTermIds={skippedTermIds}
          explainedTermIds={explainedTermIds}
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
        />
      )}

      {scene === 'transition' && (
        <TransitionScene {...sharedPhoneProps} onComplete={advanceToCooling} />
      )}

      {scene === 'ending' && (
        <EndingScene
          {...sharedPhoneProps}
          restoredTermIds={restoredTermIds}
          skippedTermIds={skippedTermIds}
          inspectedTermIds={inspectedTermIds}
          onComplete={openArchiveFromEnding}
        />
      )}

      {scene === 'about' && (
        <AboutScene
          fragments={recordedFragments}
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