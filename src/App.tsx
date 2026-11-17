import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { NarrativeAudio } from './audio/NarrativeAudio'
import { AboutScene } from './components/AboutScene'
import { EndingScene } from './components/EndingScene'
import { IntroScene } from './components/IntroScene'
import { StoryScene } from './components/StoryScene'
import { TransitionScene } from './components/TransitionScene'
import { getChapter } from './data/story'
import { themeStyle } from './data/theme'
import { useCallTimer } from './hooks/useCallTimer'
import { useReducedMotion } from './hooks/useReducedMotion'
import type { VoiceClip } from './hooks/useMicRecorder'
import type {
  Choice,
  MicPermission,
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

interface AboutReturn {
  scene: StorySceneName
  termIndex: number
}

function App() {
  const audioRef = useRef<NarrativeAudio | null>(null)
  if (!audioRef.current) audioRef.current = new NarrativeAudio()

  const [scene, setScene] = useState<Scene>('intro')
  const [termIndex, setTermIndex] = useState(0)
  const [audioMuted, setAudioMuted] = useState(false)
  const [subtitleVisible, setSubtitleVisible] = useState(false)
  const [translationOpen, setTranslationOpen] = useState(false)
  const [micPermission, setMicPermission] = useState<MicPermission>('unknown')
  const [restoredTermIds, setRestoredTermIds] = useState<string[]>([])
  const [recordedFragments, setRecordedFragments] = useState<RecordedFragment[]>([])
  const [choices, setChoices] = useState<Choice[]>([])
  const [audioLevel, setAudioLevel] = useState(0)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [aboutReturn, setAboutReturn] = useState<AboutReturn | null>(null)
  const fragmentUrlsRef = useRef<string[]>([])
  const reducedMotion = useReducedMotion()
  const callTimer = useCallTimer(isPhoneActive(scene) && audioUnlocked)

  const chapter = isStoryScene(scene) ? getChapter(scene) : null

  const resetFragmentUrls = useCallback(() => {
    fragmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    fragmentUrlsRef.current = []
  }, [])

  const startStory = useCallback(async () => {
    const engine = audioRef.current
    if (!engine) return
    setAudioMuted(false)
    engine.setMuted(false)
    await engine.unlock()
    setAudioUnlocked(true)
    setScene('call')
    setTermIndex(0)
    setTranslationOpen(false)
  }, [])

  const goHome = useCallback(() => {
    audioRef.current?.stopVoice()
    audioRef.current?.stopAmbient()
    resetFragmentUrls()
    setScene('intro')
    setTermIndex(0)
    setTranslationOpen(false)
    setSubtitleVisible(false)
    setRestoredTermIds([])
    setRecordedFragments([])
    setChoices([])
    setAboutReturn(null)
    setAudioUnlocked(false)
    callTimer.reset()
  }, [callTimer, resetFragmentUrls])

  const restart = useCallback(async () => {
    audioRef.current?.stopVoice()
    resetFragmentUrls()
    setRestoredTermIds([])
    setRecordedFragments([])
    setChoices([])
    setMicPermission('unknown')
    setAboutReturn(null)
    setSubtitleVisible(false)
    callTimer.reset()
    const engine = audioRef.current
    if (!engine) return
    setAudioMuted(false)
    engine.setMuted(false)
    await engine.unlock()
    setAudioUnlocked(true)
    setScene('call')
    setTermIndex(0)
    setTranslationOpen(false)
  }, [callTimer, resetFragmentUrls])

  const openAbout = useCallback(() => {
    if (isStoryScene(scene)) {
      setAboutReturn({ scene, termIndex })
    } else {
      setAboutReturn(null)
    }
    audioRef.current?.stopVoice()
    setTranslationOpen(false)
    setScene('about')
  }, [scene, termIndex])

  const returnFromAbout = useCallback(() => {
    if (!aboutReturn) return
    setScene(aboutReturn.scene)
    setTermIndex(aboutReturn.termIndex)
    setAboutReturn(null)
  }, [aboutReturn])

  const toggleAudio = useCallback(() => {
    setAudioMuted((muted) => {
      const next = !muted
      audioRef.current?.setMuted(next)
      return next
    })
  }, [])

  const toggleSubtitles = useCallback(() => {
    setSubtitleVisible((visible) => !visible)
  }, [])

  const choose = useCallback((choice: Choice) => {
    setChoices((previous) => [...previous, choice])
  }, [])

  const restore = useCallback((termId: string) => {
    setRestoredTermIds((previous) =>
      previous.includes(termId) ? previous : [...previous, termId],
    )
  }, [])

  const playTerm = useCallback(
    (term: StoryTerm, rate = 1) => {
      if (!audioUnlocked) return
      void audioRef.current?.playTerm(term, rate)
    },
    [audioUnlocked],
  )

  const explainTerm = useCallback(
    (term: StoryTerm) => {
      if (!audioUnlocked) return
      audioRef.current?.playHint(term.mandarinHint)
    },
    [audioUnlocked],
  )

  const advance = useCallback(() => {
    if (!chapter) return
    audioRef.current?.stopVoice()
    setTranslationOpen(false)
    if (termIndex < chapter.terms.length - 1) {
      setTermIndex((index) => index + 1)
      return
    }
    setScene(chapter.nextScene)
    setTermIndex(0)
  }, [chapter, termIndex])

  const saveClip = useCallback(
    (term: StoryTerm, clip: VoiceClip) => {
      const fragment: RecordedFragment = {
        id: `${term.id}-${clip.createdAt}`,
        scene: term.scene,
        termId: term.id,
        label: `纳凉时留在电话边的一句 · ${term.display}`,
        duration: clip.duration,
        createdAt: clip.createdAt,
        url: clip.url,
      }
      fragmentUrlsRef.current.push(clip.url)
      setRecordedFragments((previous) => [...previous, fragment])
    },
    [],
  )

  useEffect(() => {
    const engine = audioRef.current
    if (!engine || !audioUnlocked) return

    if (scene === 'call') engine.setAmbient('phone', getChapter('call').ambientSrc)
    else if (scene === 'stove') engine.setAmbient('kitchen', getChapter('stove').ambientSrc)
    else if (scene === 'transition') engine.setAmbient('night', getChapter('cooling').ambientSrc)
    else if (scene === 'cooling') engine.setAmbient('night', getChapter('cooling').ambientSrc)
    else if (scene === 'ending') engine.setAmbient('phone', getChapter('call').ambientSrc)
    else engine.setAmbient('none')

    return () => {
      // The next scene starts its ambience immediately; stop only on unmount/about.
      if (scene === 'about' || scene === 'intro') engine.stopAmbient()
    }
  }, [audioUnlocked, scene])

  useEffect(() => {
    if (!audioUnlocked) {
      setAudioLevel(0)
      return
    }
    const engine = audioRef.current
    if (!engine) return
    let frame = 0
    let lastUpdate = 0
    const readLevel = (now: number) => {
      if (now - lastUpdate > 45) {
        setAudioLevel(engine.getLevel())
        lastUpdate = now
      }
      frame = requestAnimationFrame(readLevel)
    }
    frame = requestAnimationFrame(readLevel)
    return () => cancelAnimationFrame(frame)
  }, [audioUnlocked])

  useEffect(() => {
    const handleVisibility = () => {
      audioRef.current?.pauseForVisibility(document.hidden)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => {
    return () => {
      void audioRef.current?.close()
      resetFragmentUrls()
    }
  }, [resetFragmentUrls])

  const advanceToCooling = useCallback(() => {
    setScene('cooling')
    setTermIndex(0)
  }, [])

  const openArchiveFromEnding = useCallback(() => {
    audioRef.current?.stopVoice()
    setAboutReturn(null)
    setScene('about')
  }, [])

  const sharedPhoneProps = {
    timer: callTimer.label,
    audioLevel,
    audioMuted,
    subtitleVisible,
    reducedMotion,
    onToggleAudio: toggleAudio,
    onToggleSubtitles: toggleSubtitles,
    onOpenAbout: openAbout,
  }

  return (
    <div
      className="experience"
      style={themeStyle}
      data-choice-count={choices.length}
      data-mic-permission={micPermission}
    >
      {scene === 'intro' && (
        <IntroScene onStart={() => void startStory()} onOpenAbout={openAbout} />
      )}

      {chapter && (
        <StoryScene
          key={chapter.scene}
          {...sharedPhoneProps}
          chapter={chapter}
          termIndex={termIndex}
          translationOpen={translationOpen}
          restoredTermIds={restoredTermIds}
          onAdvance={advance}
          onPlayTerm={playTerm}
          onExplain={explainTerm}
          onOpenMeaning={() => setTranslationOpen(true)}
          onCloseMeaning={() => setTranslationOpen(false)}
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
          restoredCount={restoredTermIds.length}
          onComplete={openArchiveFromEnding}
        />
      )}

      {scene === 'about' && (
        <AboutScene
          fragments={recordedFragments}
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