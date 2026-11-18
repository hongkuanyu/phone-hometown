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
 * One source of truth for the glass-fracture timeline.
 * All values are milliseconds. The sum of the four break phases is the
 * duration from the first crack to the stable suspended result.
 */
export const GLASS_TIMING = {
  call: {
    readingHold: 360,
    impactDuration: 70,
    crackDuration: 110,
    burstDuration: 400,
    settleDuration: 220,
    motionScale: 0.76,
  },
  stove: {
    readingHold: 400,
    impactDuration: 80,
    crackDuration: 120,
    burstDuration: 420,
    settleDuration: 180,
    motionScale: 0.84,
  },
  cooling: {
    readingHold: 320,
    impactDuration: 60,
    crackDuration: 100,
    burstDuration: 380,
    settleDuration: 140,
    motionScale: 1.1,
  },
  transition: {
    readingHold: 300,
    impactDuration: 70,
    crackDuration: 110,
    burstDuration: 360,
    settleDuration: 160,
    motionScale: 0.9,
  },
  ending: {
    readingHold: 420,
    impactDuration: 100,
    crackDuration: 180,
    burstDuration: 470,
    settleDuration: 350,
    motionScale: 0.96,
  },
  reduced: {
    readingHold: 250,
    impactDuration: 60,
    crackDuration: 80,
    burstDuration: 180,
    settleDuration: 130,
    motionScale: 0.22,
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
    recombineMs: 90,
    replayHoldMs: 80,
  },
} as const

export type GlassTimingKey = keyof Pick<
  typeof GLASS_TIMING,
  'call' | 'stove' | 'cooling' | 'transition' | 'ending' | 'reduced'
>