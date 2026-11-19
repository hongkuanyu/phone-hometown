export type Scene =
  | 'intro'
  | 'call'
  | 'stove'
  | 'transition'
  | 'cooling'
  | 'ending'
  | 'about'

export type StoryScene = 'call' | 'stove' | 'cooling'
export type AmbientMode = 'none' | 'phone' | 'kitchen' | 'night'
export type MicPermission = 'unknown' | 'granted' | 'denied' | 'unsupported'
export type PlaybackRate = 0.85 | 1 | 1.15

export interface StoryTerm {
  id: string
  scene: StoryScene
  speaker: '母亲'
  display: string
  familyText: string
  spokenText: string
  pronunciation: string
  mandarinHint: string
  context: string
  supplement: string
  beat: string
  /** Keep the editorial status in data only; do not surface it in the main UI. */
  transcriptStatus: 'placeholder' | 'recorded' | 'confirmed'
  /** Authorized main-sentence recording for this term. */
  audioSrc?: string
  /** Optional recording of the mother's supplemental explanation. */
  supplementAudioSrc?: string
  voiceRate?: number
}

export interface AudioPlaybackResult {
  kind: 'recording' | 'placeholder'
  durationMs: number
}

export interface StoryChapter {
  scene: StoryScene
  eyebrow: string
  stage: string
  ambient: Exclude<AmbientMode, 'none'>
  /** Optional authorized local loop for this chapter. */
  ambientSrc?: string
  opening: string
  terms: StoryTerm[]
  nextScene: Scene
  nextLabel: string
  chapterNote: string
}

export type ChoiceType =
  | 'replay'
  | 'explain'
  | 'meaning'
  | 'skip'
  | 'pretend'
  | 'follow'
  | 'save'

export interface Choice {
  scene: Scene
  type: ChoiceType
  termId?: string
}

export interface RecordedFragment {
  id: string
  scene: StoryScene
  termId: string
  label: string
  source: string
  duration: number
  createdAt: number
  url: string
}

export interface ExperienceState {
  scene: Scene
  audioMuted: boolean
  audioPaused: boolean
  subtitleVisible: boolean
  translationOpen: boolean
  micPermission: MicPermission
  currentTermId: string | null
  restoredTermIds: string[]
  skippedTermIds: string[]
  explainedTermIds: string[]
  inspectedTermIds: string[]
  recordedFragments: RecordedFragment[]
  choices: Choice[]
}