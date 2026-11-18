export interface GlassTimingProfile {
  /** Time the word stays readable before the first crack appears. */
  intactHold: number
  /** Time for crack layers to travel across the glyph. */
  crackDuration: number
  /** Fast separation of the glass pieces. */
  burstDuration: number
  /** First impact, rotation and suspension settle. */
  settleDuration: number
  /** Multiplier used by fragment travel; keeps chapter character distinct. */
  motionScale: number
}

/**
 * One source of truth for the glass-fracture timeline.
 * All values are milliseconds.
 */
export const GLASS_TIMING = {
  call: {
    intactHold: 100,
    crackDuration: 120,
    burstDuration: 220,
    settleDuration: 210,
    motionScale: 0.62,
  },
  stove: {
    intactHold: 110,
    crackDuration: 150,
    burstDuration: 240,
    settleDuration: 260,
    motionScale: 0.8,
  },
  cooling: {
    intactHold: 90,
    crackDuration: 110,
    burstDuration: 200,
    settleDuration: 180,
    motionScale: 1.16,
  },
  transition: {
    intactHold: 100,
    crackDuration: 120,
    burstDuration: 220,
    settleDuration: 210,
    motionScale: 0.9,
  },
  ending: {
    intactHold: 160,
    crackDuration: 220,
    burstDuration: 350,
    settleDuration: 320,
    motionScale: 1,
  },
  reduced: {
    intactHold: 100,
    crackDuration: 90,
    burstDuration: 100,
    settleDuration: 130,
    motionScale: 0.32,
  },
  onset: {
    attackSeconds: 0.05,
    releaseSeconds: 0.11,
    windowMs: 70,
    debounceMs: 210,
    boostDurationMs: 260,
    minimumThreshold: 0.008,
    baselineMultiplier: 1.2,
  },
  replay: {
    aggregateMs: 0,
  },
} as const

export type GlassTimingKey = keyof Pick<
  typeof GLASS_TIMING,
  'call' | 'stove' | 'cooling' | 'transition' | 'ending' | 'reduced'
>