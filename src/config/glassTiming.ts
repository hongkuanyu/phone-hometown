export interface GlassTimingProfile {
  /** Complete reading window before the fracture timeline starts. */
  readingHold: number
  /** 0—80ms: impact point, stress, first crack. */
  impactDuration: number
  /** Next 120ms: main and secondary cracks expand. */
  crackDuration: number
  /** Fracture, separation and the main outward motion. */
  burstDuration: number
  /** Deceleration into the suspended state. */
  settleDuration: number
  /** Chapter-level distance multiplier; not a timing value. */
  motionScale: number
}

/**
 * Timing for transition, ending and audio-missing demo timelines.
 * Voice scenes ignore the fixed phase durations and use the active
 * mother recording's media position as the master clock. `motionScale`
 * still applies to voice-driven fragment distance.
 */
export const GLASS_TIMING = {
  call: {
    readingHold: 360,
    impactDuration: 70,
    crackDuration: 110,
    burstDuration: 400,
    settleDuration: 220,
    motionScale: 0.46,
  },
  stove: {
    readingHold: 400,
    impactDuration: 80,
    crackDuration: 120,
    burstDuration: 420,
    settleDuration: 180,
    motionScale: 0.53,
  },
  cooling: {
    readingHold: 320,
    impactDuration: 60,
    crackDuration: 100,
    burstDuration: 380,
    settleDuration: 140,
    motionScale: 0.61,
  },
  transition: {
    readingHold: 300,
    impactDuration: 70,
    crackDuration: 110,
    burstDuration: 360,
    settleDuration: 160,
    motionScale: 0.54,
  },
  ending: {
    readingHold: 420,
    impactDuration: 100,
    crackDuration: 180,
    burstDuration: 470,
    settleDuration: 350,
    motionScale: 0.62,
  },
  reduced: {
    readingHold: 250,
    impactDuration: 60,
    crackDuration: 80,
    burstDuration: 180,
    settleDuration: 130,
    motionScale: 0.18,
  },
  onset: {
    attackSeconds: 0.05,
    releaseSeconds: 0.11,
    windowMs: 70,
    debounceMs: 210,
    minimumThreshold: 0.008,
    baselineMultiplier: 1.2,
    boostDurationMs: 260,
  },
  replay: {
    recombineMs: 260,
    replayHoldMs: 140,
  },
} as const

export type GlassTimingKey = keyof Pick<
  typeof GLASS_TIMING,
  'call' | 'stove' | 'cooling' | 'transition' | 'ending' | 'reduced'
>