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
  beat: string
  /** Add an authorized local recording here later, for example `audio/call-01.mp3`. */
  audioSrc?: string
  /** Optional local ambience for this line. Generated ambience is used by default. */
  ambientSrc?: string
  voiceRate?: number
}

export interface StoryChapter {
  scene: StoryScene
  eyebrow: string
  stage: string
  ambient: Exclude<AmbientMode, 'none'>
  /** Optional authorized local loop for this chapter. */
  ambientSrc?: string
  terms: StoryTerm[]
  nextScene: Scene
  nextLabel: string
  chapterNote: string
}

export interface Choice {
  scene: Scene
  type:
    | 'replay'
    | 'explain'
    | 'meaning'
    | 'skip'
    | 'pretend'
    | 'follow'
    | 'save'
  termId?: string
}

export interface RecordedFragment {
  id: string
  scene: StoryScene
  termId: string
  label: string
  duration: number
  createdAt: number
  url: string
}

export interface ExperienceState {
  scene: Scene
  audioMuted: boolean
  subtitleVisible: boolean
  translationOpen: boolean
  micPermission: MicPermission
  currentTermId: string | null
  restoredTermIds: string[]
  recordedFragments: RecordedFragment[]
  choices: Choice[]
}