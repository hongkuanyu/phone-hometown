import { useEffect, useRef, useState } from 'react'
import { GLASS_TIMING } from '../config/glassTiming'
import type {
  RestorationSource,
  StoryScene,
  VoicePlaybackSnapshot,
} from '../types'

type GlassChapter = StoryScene | 'transition' | 'ending'
type FractureMode = 'voice' | 'timed'
type GlyphLayoutMode = 'auto' | 'horizontal'

interface SoundTextCanvasProps {
  text: string
  stateKey: string
  replayToken: number
  audioLevel: number
  restoration: number
  reducedMotion: boolean
  speaking?: boolean
  restored?: boolean
  fragmentBias?: number
  chapter?: GlassChapter
  fractureMode?: FractureMode
  layoutMode?: GlyphLayoutMode
  getVoicePlayback?: () => VoicePlaybackSnapshot
  restorationSource?: RestorationSource
  guideActive?: boolean
  onTermClick?: () => void
  nextText?: string
  labelPrefix?: string
}

interface Point {
  x: number
  y: number
}

interface CharCell {
  char: string
  x: number
  y: number
  size: number
  weight: number
}

interface FragmentBounds {
  left: number
  top: number
  width: number
  height: number
}

type FragmentMobility = 'anchor' | 'loose' | 'lost'

interface GlassFragment {
  polygon: Point[]
  centroid: Point
  bounds: FragmentBounds
  depth: number
  mobilityRank: number
  mobilityClass: FragmentMobility
  characterBias: number
  motionX: number
  motionY: number
  rotation: number
  phase: number
  restoreRank: number
  startDelay: number
  voiceDelay: number
  opacity: number
  scale: number
  drift: number
  drawX: number
  drawY: number
  width: number
  height: number
  sprite: HTMLCanvasElement
  voiceSprite: HTMLCanvasElement | null
  rhythmSprite: HTMLCanvasElement | null
}

interface GlassGeometry {
  width: number
  height: number
  dpr: number
  chars: CharCell[]
  fragments: GlassFragment[]
  seedCount: number
  glyphSurface: HTMLCanvasElement
  glyphResidueSurface: HTMLCanvasElement
  glyphOutlineSurface: HTMLCanvasElement
  crackLayers: HTMLCanvasElement[]
  impacts: Point[]
}

const bodyFont =
  '"Source Han Serif SC", "Noto Serif SC", "Songti SC", STSong, SimSun, serif'

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const easeOutCubic = (value: number) => 1 - (1 - value) ** 3

const easeInOutCubic = (value: number) =>
  value < 0.5
    ? 4 * value * value * value
    : 1 - (-2 * value + 2) ** 3 / 2

const voiceDistanceScale = 0.87

function scheduleIdleWork(callback: IdleRequestCallback) {
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback, { timeout: 240 })
  }
  return window.setTimeout(
    () =>
      callback({
        didTimeout: false,
        timeRemaining: () => 0,
      }),
    80,
  )
}

function cancelIdleWork(handle: number) {
  if (typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(handle)
  } else {
    window.clearTimeout(handle)
  }
}

type FragmentTint = 'base' | 'voice' | 'rhythm'

function ensureRestoredSprite(
  geometry: GlassGeometry,
  fragment: GlassFragment,
  tint: Exclude<FragmentTint, 'base'>,
) {
  const key = tint === 'voice' ? 'voiceSprite' : 'rhythmSprite'
  if (!fragment[key]) {
    fragment[key] = makeFragmentSprite(
      geometry.glyphSurface,
      fragment.bounds,
      fragment.polygon,
      geometry.dpr,
      tint,
    )
  }
  return fragment[key]
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function makeCharLayout(
  width: number,
  height: number,
  text: string,
  forceHorizontal = false,
): CharCell[] {
  const chars = Array.from(text.replace(/\s+/g, ''))
  const vertical = width < 660 && width / Math.max(1, height) < 1.35 && !forceHorizontal
  const cells: CharCell[] = []

  if (vertical) {
    const perColumn = chars.length > 8 ? 5 : Math.max(1, chars.length)
    const columnCount = Math.ceil(chars.length / perColumn)
    const columnGap = Math.min(72, width / (columnCount + 1))
    const charGap = clamp((height - 120) / perColumn, 44, 63)
    const charSize = clamp(columnGap * 0.88, 38, 54)

    for (let column = 0; column < columnCount; column += 1) {
      const inColumn = Math.min(perColumn, chars.length - column * perColumn)
      const x = width / 2 + ((columnCount - 1) * columnGap) / 2 - column * columnGap
      const top = height / 2 - ((inColumn - 1) * charGap) / 2
      for (let row = 0; row < inColumn; row += 1) {
        const char = chars[column * perColumn + row]
        if (!char) continue
        cells.push({
          char,
          x,
          y: top + row * charGap,
          size: charSize,
          weight: char.charCodeAt(0) % 3 === 0 ? 600 : 400,
        })
      }
    }
  } else {
    const rows = chars.length > 8 ? 2 : 1
    const perRow = Math.ceil(chars.length / rows)
    const rowGap = clamp(height * 0.15, 88, 138)
    const cell = clamp(
      Math.min((width - 100) / perRow, (height - 110) / rows / 1.4),
      forceHorizontal ? 34 : 58,
      forceHorizontal ? 88 : 104,
    )
    for (let row = 0; row < rows; row += 1) {
      const inRow = Math.min(perRow, chars.length - row * perRow)
      const y = height / 2 + (row - (rows - 1) / 2) * rowGap
      const startX = width / 2 - ((inRow - 1) * cell * 1.1) / 2
      for (let column = 0; column < inRow; column += 1) {
        const char = chars[row * perRow + column]
        if (!char) continue
        cells.push({
          char,
          x: startX + column * cell * 1.1,
          y,
          size: cell * 0.86,
          weight: char.charCodeAt(0) % 3 === 0 ? 600 : 400,
        })
      }
    }
  }

  return cells
}

function getTextBounds(chars: CharCell[], width: number, height: number) {
  let left = width
  let top = height
  let right = 0
  let bottom = 0
  for (const char of chars) {
    left = Math.min(left, char.x - char.size * 0.72)
    right = Math.max(right, char.x + char.size * 0.72)
    top = Math.min(top, char.y - char.size * 0.88)
    bottom = Math.max(bottom, char.y + char.size * 0.88)
  }
  return {
    left: Math.max(0, left - 14),
    top: Math.max(0, top - 16),
    right: Math.min(width, right + 14),
    bottom: Math.min(height, bottom + 16),
  }
}

function createSurface(width: number, height: number, dpr: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(width * dpr))
  canvas.height = Math.max(1, Math.ceil(height * dpr))
  return canvas
}

function polygonArea(polygon: Point[]) {
  let area = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    area += current.x * next.y - next.x * current.y
  }
  return Math.abs(area) / 2
}

function polygonCentroid(polygon: Point[]): Point {
  let signedArea = 0
  let x = 0
  let y = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    const cross = current.x * next.y - next.x * current.y
    signedArea += cross
    x += (current.x + next.x) * cross
    y += (current.y + next.y) * cross
  }
  if (Math.abs(signedArea) < 0.001) {
    const average = polygon.reduce(
      (result, point) => ({ x: result.x + point.x, y: result.y + point.y }),
      { x: 0, y: 0 },
    )
    return {
      x: average.x / polygon.length,
      y: average.y / polygon.length,
    }
  }
  return {
    x: x / (3 * signedArea),
    y: y / (3 * signedArea),
  }
}

function clipPolygonToBisector(
  polygon: Point[],
  seed: Point,
  other: Point,
  seedWeight: number,
  otherWeight: number,
) {
  const dx = other.x - seed.x
  const dy = other.y - seed.y
  const midpointX = (seed.x + other.x) / 2
  const midpointY = (seed.y + other.y) / 2
  const weightOffset = (seedWeight - otherWeight) / 2
  const side = (point: Point) =>
    (point.x - midpointX) * dx +
    (point.y - midpointY) * dy -
    weightOffset

  const output: Point[] = []
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    const currentSide = side(current)
    const nextSide = side(next)
    const currentInside = currentSide <= 0.0001
    const nextInside = nextSide <= 0.0001

    if (currentInside) output.push(current)
    if (currentInside !== nextInside) {
      const ratio = currentSide / (currentSide - nextSide)
      output.push({
        x: current.x + (next.x - current.x) * ratio,
        y: current.y + (next.y - current.y) * ratio,
      })
    }
  }
  return output
}
function tracePolygon(
  context: CanvasRenderingContext2D,
  polygon: Point[],
  offsetX = 0,
  offsetY = 0,
) {
  if (polygon.length === 0) return
  context.beginPath()
  context.moveTo(polygon[0].x + offsetX, polygon[0].y + offsetY)
  for (let index = 1; index < polygon.length; index += 1) {
    context.lineTo(polygon[index].x + offsetX, polygon[index].y + offsetY)
  }
  context.closePath()
}

function drawGlyphSurface(
  width: number,
  height: number,
  dpr: number,
  chars: CharCell[],
  fillStyle = '#A84432',
) {
  const surface = createSurface(width, height, dpr)
  const context = surface.getContext('2d')
  if (!context) return surface
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = fillStyle
  for (const char of chars) {
    context.font = `${char.weight} ${char.size}px ${bodyFont}`
    context.fillText(char.char, char.x, char.y)
  }
  return surface
}

function drawGlyphOutlineSurface(
  width: number,
  height: number,
  dpr: number,
  chars: CharCell[],
) {
  const surface = createSurface(width, height, dpr)
  const context = surface.getContext('2d')
  if (!context) return surface
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.strokeStyle = '#D7CBB9'
  context.lineWidth = 0.42
  for (const char of chars) {
    context.font = `${char.weight} ${char.size}px ${bodyFont}`
    context.strokeText(char.char, char.x, char.y)
  }
  return surface
}

function makeFragmentSprite(
  glyphSurface: HTMLCanvasElement,
  bounds: FragmentBounds,
  polygon: Point[],
  dpr: number,
  tint: FragmentTint,
) {
  const surface = createSurface(bounds.width, bounds.height, dpr)
  const context = surface.getContext('2d')
  if (!context) return surface

  const sourceX = Math.max(0, Math.floor(bounds.left * dpr))
  const sourceY = Math.max(0, Math.floor(bounds.top * dpr))
  const sourceWidth = Math.max(
    1,
    Math.min(glyphSurface.width - sourceX, Math.ceil(bounds.width * dpr)),
  )
  const sourceHeight = Math.max(
    1,
    Math.min(glyphSurface.height - sourceY, Math.ceil(bounds.height * dpr)),
  )
  context.drawImage(
    glyphSurface,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    surface.width,
    surface.height,
  )

  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.translate(-bounds.left, -bounds.top)
  context.globalCompositeOperation = 'destination-in'
  context.fillStyle = '#ffffff'
  tracePolygon(context, polygon)
  context.fill()

  if (tint !== 'base') {
    context.globalCompositeOperation = 'source-in'
    context.fillStyle =
      tint === 'voice'
        ? 'rgba(242, 242, 234, 0.93)'
        : 'rgba(201, 190, 172, 0.86)'
    context.fillRect(bounds.left, bounds.top, bounds.width, bounds.height)
  }

  context.globalCompositeOperation = 'source-atop'
  context.strokeStyle =
    tint === 'voice'
      ? 'rgba(255, 255, 250, 0.52)'
      : tint === 'rhythm'
        ? 'rgba(214, 202, 184, 0.42)'
        : 'rgba(205, 193, 174, 0.16)'
  context.lineWidth = tint === 'base' ? 0.38 : 0.58
  tracePolygon(context, polygon)
  context.stroke()
  context.globalCompositeOperation = 'source-over'
  return surface
}
function makeCrackLayers(
  glyphSurface: HTMLCanvasElement,
  width: number,
  height: number,
  dpr: number,
  fragments: Array<{ polygon: Point[] }>,
  impacts: Point[],
  seed: number,
) {
  const edgeMap = new Map<
    string,
    { start: Point; end: Point; rank: number; random: number }
  >()
  const rng = mulberry32(seed ^ 0x8f3a21)

  for (const fragment of fragments) {
    for (let index = 0; index < fragment.polygon.length; index += 1) {
      const start = fragment.polygon[index]
      const end = fragment.polygon[(index + 1) % fragment.polygon.length]
      const startKey = `${start.x.toFixed(1)},${start.y.toFixed(1)}`
      const endKey = `${end.x.toFixed(1)},${end.y.toFixed(1)}`
      const key = startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`
      if (edgeMap.has(key)) continue

      const midpoint = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      }
      const nearestImpact = Math.min(
        ...impacts.map((impact) =>
          Math.hypot(midpoint.x - impact.x, midpoint.y - impact.y),
        ),
      )
      edgeMap.set(key, {
        start,
        end,
        rank: nearestImpact,
        random: rng(),
      })
    }
  }

  const edges = Array.from(edgeMap.values()).sort((a, b) => a.rank - b.rank)
  if (edges.length === 0) return [createSurface(width, height, dpr)]
  const maxRank = Math.max(...edges.map((edge) => edge.rank), 1)
  const layers: Array<Array<(typeof edges)[number]>> = [[], [], []]
  for (const edge of edges) {
    const normalized = clamp(edge.rank / maxRank + (edge.random - 0.5) * 0.16, 0, 1)
    const layer = normalized < 0.2 ? 0 : normalized < 0.52 ? 1 : 2
    layers[layer].push(edge)
  }

  return layers.map((layer) => {
    const surface = createSurface(width, height, dpr)
    const context = surface.getContext('2d')
    if (!context) return surface
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.lineCap = 'round'
    context.lineJoin = 'round'

    for (const edge of layer) {
      context.beginPath()
      context.moveTo(edge.start.x, edge.start.y)
      context.lineTo(edge.end.x, edge.end.y)
      context.strokeStyle =
        rng() > 0.88
          ? 'rgba(168, 68, 50, 0.34)'
          : 'rgba(205, 193, 174, 0.36)'
      context.lineWidth = 0.26 + rng() * 0.18
      context.stroke()
    }

    context.setTransform(1, 0, 0, 1, 0, 0)
    context.globalCompositeOperation = 'destination-in'
    context.drawImage(glyphSurface, 0, 0)
    context.globalCompositeOperation = 'source-over'
    return surface
  })
}
const geometryCache = new Map<string, GlassGeometry>()
const geometryCacheLimit = 3

function geometryCacheKey(
  width: number,
  height: number,
  text: string,
  chapter: GlassChapter,
  reducedMotion: boolean,
  layoutMode: GlyphLayoutMode,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  return [
    Math.round(width),
    Math.round(height),
    dpr.toFixed(2),
    chapter,
    reducedMotion ? 'reduced' : 'full',
    layoutMode,
    text,
  ].join('|')
}

function cacheGeometry(
  key: string,
  geometry: GlassGeometry | null,
) {
  if (!geometry) return
  if (geometryCache.size >= geometryCacheLimit) {
    const oldestKey = geometryCache.keys().next().value
    if (oldestKey) geometryCache.delete(oldestKey)
  }
  geometryCache.set(key, geometry)
}

function prewarmGlassGeometry(
  width: number,
  height: number,
  text: string,
  chapter: GlassChapter,
  reducedMotion: boolean,
) {
  const key = geometryCacheKey(
    width,
    height,
    text,
    chapter,
    reducedMotion,
    'auto',
  )
  if (geometryCache.has(key)) return
  cacheGeometry(
    key,
    buildGeometry(width, height, text, chapter, reducedMotion),
  )
}

interface GlassPrewarmProps {
  width: number
  height: number
  text: string
  chapter: GlassChapter
  reducedMotion: boolean
}

export function GlassPrewarm({
  width,
  height,
  text,
  chapter,
  reducedMotion,
}: GlassPrewarmProps) {
  useEffect(() => {
    let cancelled = false
    let idleHandle: number | null = null
    let timeoutHandle: number | null = null

    const build = () => {
      if (cancelled) return
      prewarmGlassGeometry(width, height, text, chapter, reducedMotion)
    }
    const schedule = () => {
      if (cancelled) return
      if (typeof window.requestIdleCallback === 'function') {
        idleHandle = window.requestIdleCallback(build, { timeout: 1200 })
      } else {
        timeoutHandle = window.setTimeout(build, 350)
      }
    }

    void document.fonts.ready.then(schedule)
    return () => {
      cancelled = true
      if (
        idleHandle !== null &&
        typeof window.cancelIdleCallback === 'function'
      ) {
        window.cancelIdleCallback(idleHandle)
      }
      if (timeoutHandle !== null) window.clearTimeout(timeoutHandle)
    }
  }, [chapter, height, reducedMotion, text, width])

  return null
}

function buildGeometry(
  width: number,
  height: number,
  text: string,
  chapter: GlassChapter,
  reducedMotion: boolean,
  layoutMode: GlyphLayoutMode = 'auto',
): GlassGeometry | null {
  if (width < 2 || height < 2 || !text) return null
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  const chars = makeCharLayout(width, height, text, layoutMode === 'horizontal')
  if (chars.length === 0) return null
  const textBounds = getTextBounds(chars, width, height)
  const glyphSurface = drawGlyphSurface(width, height, dpr, chars)
  const glyphResidueSurface = drawGlyphSurface(
    width,
    height,
    dpr,
    chars,
    '#D7CBB9',
  )
  const glyphOutlineSurface = drawGlyphOutlineSurface(width, height, dpr, chars)
  const seed = hashString(`${text}|${chapter}|glass-v4`)
  const rng = mulberry32(seed)
  const characterBias = chars.map((char, index) =>
    (mulberry32(seed ^ hashString(`${char.char}|${index}|timeline`))() * 2 - 1) * 0.045,
  )
  const isMobile = width < 660
  const averageCharSize = chars.reduce((sum, char) => sum + char.size, 0) / chars.length
  const perCharTarget = chapter === 'call' ? 30 : chapter === 'stove' ? 34 : chapter === 'cooling' ? 38 : 34
  const mobilePerCharTarget = chapter === 'call' ? 17 : chapter === 'stove' ? 19 : chapter === 'cooling' ? 21 : 18
  const desktopBudget = chapter === 'call' ? 120 : chapter === 'stove' ? 135 : chapter === 'cooling' ? 150 : 132
  const mobileBudget = chapter === 'call' ? 65 : chapter === 'stove' ? 72 : chapter === 'cooling' ? 80 : 68
  const baseTarget = isMobile ? chars.length * mobilePerCharTarget : chars.length * perCharTarget
  const budget = reducedMotion ? (isMobile ? 42 : 72) : isMobile ? mobileBudget : desktopBudget
  const effectiveTarget = baseTarget * (reducedMotion ? 0.48 : 1)
  const seedCount = clamp(
    Math.round(effectiveTarget),
    reducedMotion ? (isMobile ? 20 : 40) : isMobile ? 44 : 96,
    budget,
  )
  const glyphReadContext = glyphSurface.getContext('2d', {
    willReadFrequently: true,
  })
  const glyphPixels = glyphReadContext?.getImageData(
    0,
    0,
    glyphSurface.width,
    glyphSurface.height,
  ).data
  const glyphPointsByChar = chars.map((char) => {
    const points: Point[] = []
    if (!glyphPixels) return points
    const left = Math.max(0, Math.floor((char.x - char.size * 0.62) * dpr))
    const right = Math.min(
      glyphSurface.width,
      Math.ceil((char.x + char.size * 0.62) * dpr),
    )
    const top = Math.max(0, Math.floor((char.y - char.size * 0.78) * dpr))
    const bottom = Math.min(
      glyphSurface.height,
      Math.ceil((char.y + char.size * 0.78) * dpr),
    )
    for (let pixelY = top; pixelY < bottom; pixelY += 2) {
      for (let pixelX = left; pixelX < right; pixelX += 2) {
        const alpha =
          glyphPixels[(pixelY * glyphSurface.width + pixelX) * 4 + 3]
        if (alpha > 7) {
          points.push({ x: pixelX / dpr, y: pixelY / dpr })
        }
      }
    }
    return points
  })

  const seeds: Array<{ point: Point; weight: number }> = []
  const perCharQuota = Math.max(1, Math.ceil(seedCount / chars.length))
  for (let charIndex = 0; charIndex < chars.length; charIndex += 1) {
    const char = chars[charIndex]
    const candidates = glyphPointsByChar[charIndex]
    if (candidates.length === 0) continue
    const remaining = seedCount - seeds.length
    if (remaining <= 0) break
    const quota = Math.min(
      remaining,
      charIndex === chars.length - 1 ? remaining : perCharQuota,
    )
    const charSeeds: Point[] = []
    for (let index = 0; index < quota; index += 1) {
      let point = candidates[Math.floor(rng() * candidates.length)]
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = candidates[Math.floor(rng() * candidates.length)]
        if (
          charSeeds.every(
            (existing) => Math.hypot(existing.x - candidate.x, existing.y - candidate.y) > 1.35,
          )
        ) {
          point = candidate
          break
        }
      }
      charSeeds.push(point)
      const weight =
        (rng() - 0.5) * char.size * char.size * (isMobile ? 0.0008 : 0.0012)
      seeds.push({ point, weight })
    }
  }

  const baseRectangle: Point[] = [
    { x: textBounds.left, y: textBounds.top },
    { x: textBounds.right, y: textBounds.top },
    { x: textBounds.right, y: textBounds.bottom },
    { x: textBounds.left, y: textBounds.bottom },
  ]
  const impacts: Point[] = []
  const impactCount = rng() > 0.7 ? 2 : 1
  for (let index = 0; index < impactCount; index += 1) {
    const char = chars[Math.floor(rng() * chars.length)]
    impacts.push({
      x: char.x + (rng() * 2 - 1) * char.size * 0.32,
      y: char.y + (rng() * 2 - 1) * char.size * 0.35,
    })
  }
  const fragments: GlassFragment[] = []
  for (let index = 0; index < seeds.length; index += 1) {
    const seedPoint = seeds[index].point
    let polygon = baseRectangle
    for (let otherIndex = 0; otherIndex < seeds.length; otherIndex += 1) {
      if (otherIndex === index) continue
      polygon = clipPolygonToBisector(polygon, seedPoint, seeds[otherIndex].point, seeds[index].weight, seeds[otherIndex].weight)
      if (polygon.length < 3) break
    }
    if (polygon.length < 3 || polygonArea(polygon) < 0.8) continue
    const centroid = polygonCentroid(polygon)
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity
    for (const point of polygon) {
      left = Math.min(left, point.x)
      top = Math.min(top, point.y)
      right = Math.max(right, point.x)
      bottom = Math.max(bottom, point.y)
    }
    const bounds: FragmentBounds = {
      left: Math.max(0, Math.floor(left - 2)),
      top: Math.max(0, Math.floor(top - 2)),
      width: Math.ceil(right - left + 4),
      height: Math.ceil(bottom - top + 4),
    }
    const baseSprite = makeFragmentSprite(glyphSurface, bounds, polygon, dpr, 'base')
    const depth = rng() * 2 - 1
    const mobilityRank = rng()
    const anchorRatio = chapter === 'cooling' ? 0.54 : chapter === 'stove' ? 0.57 : 0.6
    const looseRatio = chapter === 'cooling' ? 0.3 : 0.29
    const mobilityClass: FragmentMobility =
      mobilityRank < anchorRatio
        ? 'anchor'
        : mobilityRank < anchorRatio + looseRatio
          ? 'loose'
          : 'lost'
    const finalDistanceFactor =
      mobilityClass === 'anchor'
        ? chapter === 'cooling'
          ? 0.1 + rng() * 0.08
          : chapter === 'stove'
            ? 0.095 + rng() * 0.07
            : 0.09 + rng() * 0.065
        : mobilityClass === 'loose'
          ? chapter === 'cooling'
            ? 0.19 + rng() * 0.15
            : chapter === 'stove'
              ? 0.17 + rng() * 0.13
              : 0.15 + rng() * 0.12
          : chapter === 'cooling'
            ? 0.42 + rng() * 0.26
            : chapter === 'stove'
              ? 0.39 + rng() * 0.23
              : 0.36 + rng() * 0.22
    const nominalMotionScale =
      GLASS_TIMING[chapter].motionScale *
      (chapter === 'call' || chapter === 'stove' || chapter === 'cooling'
        ? voiceDistanceScale
        : 1)
    const referenceSize = averageCharSize * (isMobile ? 0.88 : 1)
    const distance = (referenceSize * finalDistanceFactor) / nominalMotionScale
    let nearestImpact = impacts[0]
    let nearestDistance = Infinity
    let nearestCharIndex = 0
    let nearestCharDistance = Infinity
    for (const impact of impacts) {
      const candidate = Math.hypot(centroid.x - impact.x, centroid.y - impact.y)
      if (candidate < nearestDistance) {
        nearestDistance = candidate
        nearestImpact = impact
      }
    }
    for (let charIndex = 0; charIndex < chars.length; charIndex += 1) {
      const char = chars[charIndex]
      const candidate = Math.hypot(centroid.x - char.x, centroid.y - char.y)
      if (candidate < nearestCharDistance) {
        nearestCharDistance = candidate
        nearestCharIndex = charIndex
      }
    }
    const baseAngle = nearestDistance > 1 ? Math.atan2(centroid.y - nearestImpact.y, centroid.x - nearestImpact.x) : rng() * Math.PI * 2
    const angle = baseAngle + (rng() * 2 - 1) * 0.42
    const tangentSign = rng() > 0.5 ? 1 : -1
    let motionX = Math.cos(angle) * distance + Math.cos(baseAngle + Math.PI / 2) * distance * tangentSign * (0.05 + rng() * 0.1)
    let motionY = Math.sin(angle) * distance + Math.sin(baseAngle + Math.PI / 2) * distance * tangentSign * (0.05 + rng() * 0.1) + referenceSize * (0.004 + rng() * 0.012)
    if (chapter === 'stove') motionY -= referenceSize * (0.003 + rng() * 0.009)
    if (chapter === 'cooling') motionX += referenceSize * (0.006 + rng() * 0.014)
    let safeScale = 1
    const padding = 10
    const minDx = padding - bounds.left
    const maxDx = width - padding - (bounds.left + bounds.width)
    const minDy = padding - bounds.top
    const maxDy = height - padding - (bounds.top + bounds.height)
    if (motionX > 0) safeScale = Math.min(safeScale, Math.max(0, maxDx / motionX))
    if (motionX < 0) safeScale = Math.min(safeScale, Math.max(0, minDx / motionX))
    if (motionY > 0) safeScale = Math.min(safeScale, Math.max(0, maxDy / motionY))
    if (motionY < 0) safeScale = Math.min(safeScale, Math.max(0, minDy / motionY))
    safeScale = clamp(safeScale, 0.24, 1)
    motionX *= safeScale
    motionY *= safeScale
    const maxRotation =
      mobilityClass === 'lost' ? 0.074 : mobilityClass === 'loose' ? 0.045 : 0.025
    fragments.push({
      polygon,
      centroid,
      bounds,
      depth,
      mobilityRank,
      mobilityClass,
      characterBias: characterBias[nearestCharIndex] ?? 0,
      motionX,
      motionY,
      rotation: (rng() * 2 - 1) * maxRotation * (isMobile ? 0.86 : 1),
      phase: rng() * Math.PI * 2,
      restoreRank: rng(),
      startDelay: 20 + rng() * 50,
      voiceDelay: rng() * 0.18,
      opacity:
        mobilityClass === 'lost'
          ? 0.78 + rng() * 0.14
          : mobilityClass === 'loose'
            ? 0.84 + rng() * 0.12
            : 0.9 + rng() * 0.08,
      scale: 1 + depth * 0.018,
      drift: (chapter === 'cooling' ? 0.34 : 0.2) + rng() * 0.42,
      drawX: bounds.left - centroid.x,
      drawY: bounds.top - centroid.y,
      width: bounds.width,
      height: bounds.height,
      sprite: baseSprite,
      voiceSprite: null,
      rhythmSprite: null,
    })
  }
  if (fragments.length === 0) return null
  fragments.sort((a, b) => a.depth - b.depth)
  const crackLayers = makeCrackLayers(glyphSurface, width, height, dpr, fragments, impacts, seed)
  return {
    width,
    height,
    dpr,
    chars,
    fragments,
    seedCount,
    glyphSurface,
    glyphResidueSurface,
    glyphOutlineSurface,
    crackLayers,
    impacts,
  }
}
export function SoundTextCanvas({
  text,
  stateKey,
  replayToken,
  audioLevel,
  restoration,
  reducedMotion,
  speaking = false,
  restored = false,
  fragmentBias = 0,
  chapter = 'call',
  fractureMode = 'timed',
  layoutMode = 'auto',
  getVoicePlayback,
  restorationSource,
  guideActive = false,
  onTermClick,
  nextText,
  labelPrefix = '声音文字场',
}: SoundTextCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hitArea, setHitArea] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const [debugFreeze, setDebugFreeze] = useState(false)
  const [debugTime, setDebugTime] = useState(0)
  const debugFreezeRef = useRef(false)
  const debugTimeRef = useRef<number | null>(null)
  const debugElapsedRef = useRef(0)
  const debugTiming = reducedMotion ? GLASS_TIMING.reduced : GLASS_TIMING[chapter]
  const debugBreakDuration =
    debugTiming.impactDuration +
    debugTiming.crackDuration +
    debugTiming.burstDuration +
    debugTiming.settleDuration
  const debugScrubMax = fractureMode === 'voice' ? 100 : debugBreakDuration
  const debugMarks =
    fractureMode === 'voice'
      ? [0, 25, 50, 75, 100]
      : [0, 200, 400, 600, debugBreakDuration]
  const propsRef = useRef({
    text,
    audioLevel,
    restoration,
    reducedMotion,
    speaking,
    restored,
    fragmentBias,
    chapter,
    fractureMode,
    getVoicePlayback,
    restorationSource,
  })
  const pulseRef = useRef(0)
  const fractureStartRef = useRef(0)
  const baselineLevelRef = useRef(0)
  const lastOnsetAtRef = useRef(0)
  const onsetBoostRef = useRef(0)
  const onsetSamplesRef = useRef<Array<{ at: number; level: number }>>([])
  const readingHoldRef = useRef<number>(
    (reducedMotion ? GLASS_TIMING.reduced : GLASS_TIMING[chapter]).readingHold,
  )
  const lastPostHoldRef = useRef(0)
  const recombineRef = useRef<{ start: number; fromPostHold: number } | null>(null)
  const stateKeyRef = useRef<string | null>(null)
  const replayTokenRef = useRef(replayToken)
  const hasReplayedRef = useRef(false)
  const frozenRenderTimeRef = useRef<number | null>(null)
  const frozenLevelRef = useRef(0)

  useEffect(() => {
    debugFreezeRef.current = debugFreeze
    debugTimeRef.current = debugFreeze ? debugTime : null
  }, [debugFreeze, debugTime])

  useEffect(() => {
    propsRef.current = {
      text,
      audioLevel,
      restoration,
      reducedMotion,
      speaking,
      restored,
      fragmentBias,
      chapter,
      fractureMode,
      getVoicePlayback,
      restorationSource,
    }
  }, [
    text,
    audioLevel,
    restoration,
    reducedMotion,
    speaking,
    restored,
    fragmentBias,
    chapter,
    fractureMode,
    getVoicePlayback,
    restorationSource,
  ])

  useEffect(() => {
    if (stateKeyRef.current === stateKey) return
    stateKeyRef.current = stateKey
    hasReplayedRef.current = false
    const now = performance.now()
    const timing = reducedMotion ? GLASS_TIMING.reduced : GLASS_TIMING[chapter]
    pulseRef.current = now
    readingHoldRef.current = timing.readingHold
    fractureStartRef.current =
      propsRef.current.fractureMode === 'voice' && propsRef.current.speaking
        ? now
        : 0
    baselineLevelRef.current = 0
    lastOnsetAtRef.current = 0
    onsetBoostRef.current = 0
    onsetSamplesRef.current = []
    lastPostHoldRef.current = 0
    recombineRef.current = null
  }, [chapter, reducedMotion, stateKey])

  useEffect(() => {
    if (replayTokenRef.current === replayToken) return
    replayTokenRef.current = replayToken
    hasReplayedRef.current = true
    const now = performance.now()
    pulseRef.current = now
    readingHoldRef.current = GLASS_TIMING.replay.replayHoldMs
    fractureStartRef.current = 0
    baselineLevelRef.current = 0
    lastOnsetAtRef.current = 0
    onsetBoostRef.current = 0
    onsetSamplesRef.current = []
    recombineRef.current =
      lastPostHoldRef.current > 1
        ? { start: now, fromPostHold: lastPostHoldRef.current }
        : null
    if (!recombineRef.current) {
      fractureStartRef.current =
        propsRef.current.fractureMode === 'voice' && propsRef.current.speaking
          ? now
          : 0
    }
  }, [replayToken])

  useEffect(() => {
    if (speaking && propsRef.current.fractureMode === 'voice') {
      const now = performance.now()
      if (!recombineRef.current && fractureStartRef.current === 0) {
        fractureStartRef.current = now
      }
      lastOnsetAtRef.current = now
      onsetBoostRef.current = now + GLASS_TIMING.onset.boostDurationMs
    }
  }, [speaking])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    let geometry: GlassGeometry | null = null
    let animationFrame = 0
    let resizeFrame = 0
    let hiddenAt = 0
    let nextPrewarmHandle: number | null = null
    let restoredBuildHandle: number | null = null

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)
      const hitChars = makeCharLayout(width, height, text)
      const hitBounds = getTextBounds(hitChars, width, height)
      setHitArea({
        left: hitBounds.left,
        top: hitBounds.top,
        width: Math.max(44, hitBounds.right - hitBounds.left),
        height: Math.max(44, hitBounds.bottom - hitBounds.top),
      })
      const cacheKey = geometryCacheKey(
        width,
        height,
        text,
        chapter,
        reducedMotion,
        layoutMode,
      )
      const buildStarted = performance.now()
      geometry =
        geometryCache.get(cacheKey) ??
        buildGeometry(
          width,
          height,
          text,
          chapter,
          reducedMotion,
          layoutMode,
        )
      if (geometry && !geometryCache.has(cacheKey)) {
        cacheGeometry(cacheKey, geometry)
      }
      if (import.meta.env.DEV) {
        canvas.dataset.glassBuildMs = (performance.now() - buildStarted).toFixed(1)
      }
      if (restoredBuildHandle !== null) {
        cancelIdleWork(restoredBuildHandle)
        restoredBuildHandle = null
      }
      if (nextPrewarmHandle !== null) {
        cancelIdleWork(nextPrewarmHandle)
        nextPrewarmHandle = null
      }
      if (nextText) {
        nextPrewarmHandle = scheduleIdleWork(() => {
          prewarmGlassGeometry(width, height, nextText, chapter, reducedMotion)
        })
      }
      if (geometry && !reducedMotion) {
        const activeGeometry = geometry
        let cursor = 0
        const fillRestoredSprites = () => {
          if (geometry !== activeGeometry) return
          const end = Math.min(cursor + 3, activeGeometry.fragments.length)
          for (; cursor < end; cursor += 1) {
            const fragment = activeGeometry.fragments[cursor]
            ensureRestoredSprite(activeGeometry, fragment, 'voice')
            ensureRestoredSprite(activeGeometry, fragment, 'rhythm')
          }
          if (cursor < activeGeometry.fragments.length) {
            restoredBuildHandle = scheduleIdleWork(fillRestoredSprites)
          } else {
            restoredBuildHandle = null
          }
        }
        restoredBuildHandle = scheduleIdleWork(fillRestoredSprites)
      }
    }

    const draw = () => {
      if (!geometry) return
      const current = propsRef.current
      const {
        width,
        height,
        fragments,
        glyphSurface,
        glyphResidueSurface,
        glyphOutlineSurface,
        crackLayers,
      } = geometry
      context.clearRect(0, 0, width, height)

      const now = performance.now()
      const voiceSnapshot = current.getVoicePlayback?.() ?? null
      const realVoiceClock = Boolean(
        current.fractureMode === 'voice' &&
          voiceSnapshot &&
          (voiceSnapshot.kind === 'main' || voiceSnapshot.kind === 'supplement') &&
          voiceSnapshot.durationSec > 0,
      )
      const waitingForVoice = Boolean(
        current.fractureMode === 'voice' && voiceSnapshot?.kind === 'none',
      )
      const debugValue = debugTimeRef.current
      const debugVoiceProgress =
        current.fractureMode === 'voice' && debugValue !== null
          ? clamp(debugValue / 100, 0, 1)
          : null
      const audioProgress = realVoiceClock
        ? clamp(
            (voiceSnapshot?.positionSec ?? 0) /
              Math.max(0.001, voiceSnapshot?.durationSec ?? 1),
            0,
            1,
          )
        : null
      const readableHoldFraction = realVoiceClock
        ? clamp(
            Math.min(
              0.9 / Math.max(0.001, voiceSnapshot?.durationSec ?? 1),
              0.2,
            ),
            0.04,
            0.2,
          )
        : 0
      const mediaProgress =
        debugVoiceProgress !== null
          ? readableHoldFraction +
            debugVoiceProgress * (1 - readableHoldFraction)
          : audioProgress
      const fractureProgress =
        mediaProgress !== null
          ? clamp(
              (mediaProgress - readableHoldFraction) /
                Math.max(0.001, 1 - readableHoldFraction),
              0,
              1,
            )
          : null
      const clockPaused = Boolean(
        realVoiceClock &&
          voiceSnapshot?.paused &&
          !debugFreezeRef.current &&
          debugVoiceProgress === null,
      )
      const rawLevel = clamp(current.audioLevel, 0, 1)
      if (clockPaused) {
        if (frozenRenderTimeRef.current === null) {
          frozenRenderTimeRef.current = now / 1000
          frozenLevelRef.current = rawLevel
        }
      } else {
        frozenRenderTimeRef.current = null
        frozenLevelRef.current = rawLevel
      }
      const time = debugFreezeRef.current
        ? 0
        : (frozenRenderTimeRef.current ?? now / 1000)
      const level = clockPaused ? frozenLevelRef.current : rawLevel
      const voice = clamp(level * 1.6, 0, 1)
      const timing = current.reducedMotion
        ? GLASS_TIMING.reduced
        : GLASS_TIMING[current.chapter]

      // Audio amplitude only adds local emphasis; media position owns the fracture.
      const onset = GLASS_TIMING.onset
      if (baselineLevelRef.current <= 0) {
        baselineLevelRef.current = Math.max(0.012, level * 0.35)
      }
      const baseline = baselineLevelRef.current
      const dynamicThreshold = Math.max(
        onset.minimumThreshold,
        baseline * onset.baselineMultiplier + 0.01,
      )
      const samples = onsetSamplesRef.current
      let previousWindowPeak = baseline
      for (const sample of samples) {
        previousWindowPeak = Math.max(previousWindowPeak, sample.level)
      }
      const rising =
        level - baseline > dynamicThreshold &&
        level >= previousWindowPeak * 1.05
      const onsetWindowOpen =
        now - lastOnsetAtRef.current >= onset.debounceMs
      const validOnset =
        current.speaking &&
        current.fractureMode === 'voice' &&
        rising &&
        level > dynamicThreshold * 1.25 &&
        onsetWindowOpen
      samples.push({ at: now, level })
      while (samples.length > 0 && now - samples[0].at > onset.windowMs) {
        samples.shift()
      }
      if (validOnset) {
        lastOnsetAtRef.current = now
        onsetBoostRef.current = now + onset.boostDurationMs
      }
      baselineLevelRef.current +=
        (level - baseline) * (level < baseline ? 0.14 : 0.045)
      const onsetBoost = clamp(
        (onsetBoostRef.current - now) / onset.boostDurationMs,
        0,
        1,
      )

      let recombineActive = false
      let recombinePostHold: number | null = null
      const recombine = recombineRef.current
      if (recombine) {
        const progress = clamp(
          (now - recombine.start) / GLASS_TIMING.replay.recombineMs,
          0,
          1,
        )
        if (progress >= 1) {
          recombineRef.current = null
          recombinePostHold = 0
          fractureStartRef.current = now
          readingHoldRef.current = GLASS_TIMING.replay.replayHoldMs
        } else {
          recombineActive = true
          recombinePostHold =
            recombine.fromPostHold * (1 - easeOutCubic(progress))
        }
      }

      if (debugValue !== null) {
        recombineActive = false
        recombinePostHold = null
      }

      const useVoiceTimeline = fractureProgress !== null && !recombineActive
      let fractureElapsed = 0
      if (recombineActive && recombinePostHold !== null) {
        fractureElapsed = readingHoldRef.current + recombinePostHold
      } else if (current.fractureMode === 'timed') {
        fractureElapsed = Math.max(0, now - pulseRef.current)
      } else if (waitingForVoice) {
        fractureElapsed = readingHoldRef.current
      } else if (fractureStartRef.current > 0) {
        fractureElapsed = Math.max(0, now - fractureStartRef.current)
      }
      if (debugValue !== null && !useVoiceTimeline) {
        fractureElapsed = readingHoldRef.current + debugValue
      }

      const postHold = recombineActive
        ? (recombinePostHold ?? 0)
        : useVoiceTimeline
          ? debugElapsedRef.current
          : Math.max(0, fractureElapsed - readingHoldRef.current)

      let crackProgress = 0
      let separation = 0
      let settle = 0
      let shatter = 0
      const replayScar =
        current.fractureMode === 'voice' && hasReplayedRef.current && !recombineActive
          ? 1
          : 0
      if (useVoiceTimeline) {
        const progress = fractureProgress ?? 0
        const firstCracks = clamp((progress - 0.12) / 0.18, 0, 1)
        const laterCracks = clamp((progress - 0.3) / 0.55, 0, 1)
        crackProgress =
          firstCracks * 0.28 + easeInOutCubic(laterCracks) * 0.72
        separation =
          progress < 0.55
            ? easeInOutCubic(clamp((progress - 0.3) / 0.25, 0, 1)) * 0.35
            : 0.35 +
              easeInOutCubic(clamp((progress - 0.55) / 0.3, 0, 1)) * 0.65
        settle = clamp((progress - 0.85) / 0.15, 0, 1)
        shatter = separation
        if (replayScar > 0) {
          crackProgress = Math.max(crackProgress, 0.04)
          separation = Math.max(separation, 0.035)
          shatter = Math.max(shatter, 0.035)
        }
        debugElapsedRef.current = progress * debugBreakDuration
      } else {
        const impactPhase = clamp(postHold / timing.impactDuration, 0, 1)
        const crackExpansion = clamp(
          (postHold - timing.impactDuration) / timing.crackDuration,
          0,
          1,
        )
        crackProgress =
          impactPhase < 1
            ? impactPhase * 0.22
            : 0.22 + crackExpansion * 0.78
        separation = clamp(
          (postHold - timing.impactDuration - timing.crackDuration) /
            timing.burstDuration,
          0,
          1,
        )
        settle = clamp(
          (postHold -
            timing.impactDuration -
            timing.crackDuration -
            timing.burstDuration) /
            timing.settleDuration,
          0,
          1,
        )
        shatter =
          easeOutCubic(separation) * (0.64 + easeOutCubic(settle) * 0.36)
        debugElapsedRef.current = Math.max(
          0,
          fractureElapsed - readingHoldRef.current,
        )
      }

      const motionFactor =
        clamp(shatter + current.fragmentBias, 0, 1.25) * timing.motionScale
      const restorationEnergy = clamp(
        current.restoration * 0.78 + (current.restored ? 0.1 : 0),
        0,
        0.88,
      )
      const showFragments =
        useVoiceTimeline ||
        recombineActive ||
        postHold > 0 ||
        motionFactor > 0.02 ||
        restorationEnergy > 0.05
      const fragmentReveal = showFragments
        ? useVoiceTimeline
          ? clamp((fractureProgress ?? 0) / 0.015, 0, 1)
          : recombineActive
            ? 1
            : clamp(
                Math.max(
                  postHold,
                  (motionFactor + restorationEnergy) * 36,
                ) / 36,
                0,
                1,
              )
        : 0
      const directGlyphAlpha = showFragments ? (1 - fragmentReveal) * 0.92 : 0.92
      const crackVisibility =
        1 - clamp(separation * 0.5 + settle * 0.08, 0, 0.72)
      const stressJitter =
        crackProgress *
        (0.12 + voice * 0.5) *
        (current.reducedMotion ? 0.22 : 1) *
        (useVoiceTimeline ? 1 - (fractureProgress ?? 0) * 0.82 : 1)
      lastPostHoldRef.current = useVoiceTimeline
        ? debugBreakDuration * (fractureProgress ?? 0)
        : postHold

      if (import.meta.env.DEV) {
        const stage = waitingForVoice
          ? 'intact'
          : useVoiceTimeline
            ? (fractureProgress ?? 0) <= 0.001
              ? 'intact'
              : (fractureProgress ?? 0) < 0.12
                ? 'stressed'
                : (fractureProgress ?? 0) < 0.3
                  ? 'cracked'
                  : (fractureProgress ?? 0) < 0.55
                    ? 'separating'
                    : (fractureProgress ?? 0) < 0.85
                      ? 'burst'
                      : 'suspended'
            : fractureElapsed < readingHoldRef.current
              ? 'intact'
              : separation === 0
                ? 'cracked'
                : settle < 1
                  ? 'burst'
                  : 'suspended'
        canvas.dataset.glassStage = stage
        canvas.dataset.glassElapsed = Math.round(
          useVoiceTimeline
            ? (fractureProgress ?? 0) * debugBreakDuration
            : fractureElapsed,
        ).toString()
        canvas.dataset.glassProgress = mediaProgress?.toFixed(3) ?? ''
        canvas.dataset.glassFractureProgress =
          fractureProgress?.toFixed(3) ?? ''
        canvas.dataset.glassMediaTime = (voiceSnapshot?.positionSec ?? 0).toFixed(3)
        canvas.dataset.glassDuration = (voiceSnapshot?.durationSec ?? 0).toFixed(3)
        canvas.dataset.glassClockPaused = String(clockPaused)
        canvas.dataset.glassPlaybackId = String(voiceSnapshot?.id ?? 0)
        canvas.dataset.glassOnset = onsetBoost.toFixed(2)
        canvas.dataset.glassFragments = String(fragments.length)
        canvas.dataset.glassSeeds = String(geometry.seedCount)
        canvas.dataset.glassRecombine = String(recombineActive)
        canvas.dataset.glassRestored = String(current.restored)
        canvas.dataset.glassRestorationSource = current.restorationSource ?? ''
      }

      if (directGlyphAlpha > 0.001) {
        const jitterX = Math.sin(time * 1.15) * stressJitter
        const jitterY = Math.cos(time * 1.32) * stressJitter * 0.55
        context.save()
        context.globalAlpha = directGlyphAlpha
        context.translate(jitterX, jitterY)
        context.drawImage(glyphSurface, 0, 0, width, height)
        context.restore()
        context.globalAlpha = 1
      }

      if (
        showFragments &&
        (crackProgress > 0.001 || restorationEnergy > 0.01)
      ) {
        // The residue marks where the sentence was, then recedes as every piece lifts away.
        const ghostFade = 1 - clamp(separation * 0.82 + settle * 0.08, 0, 0.9)
        context.globalAlpha = clamp(
          (0.105 + restorationEnergy * 0.012) * ghostFade,
          0.012,
          0.13,
        )
        context.drawImage(glyphResidueSurface, 0, 0, width, height)
        context.globalAlpha = clamp(
          (0.18 + restorationEnergy * 0.012) * ghostFade,
          0.02,
          0.21,
        )
        context.drawImage(glyphOutlineSurface, 0, 0, width, height)
        context.globalAlpha = 1
      }

      if (showFragments && fragmentReveal > 0.001) {
        for (const fragment of fragments) {
          let localBreak = 0
          let localSettle = 0
          if (recombineActive) {
            localSettle = settle
            localBreak = easeInOutCubic(separation)
          } else if (useVoiceTimeline) {
            const progress = fractureProgress ?? 0
            const releaseStart = 0.3 + fragment.voiceDelay
            const localProgress = clamp(
              (progress + fragment.characterBias - releaseStart) /
                Math.max(0.001, 0.85 - releaseStart),
              0,
              1,
            )
            localBreak = easeInOutCubic(localProgress)
            localSettle = clamp((progress - 0.85) / 0.15, 0, 1)
          } else {
            const localPostHold = Math.max(
              0,
              postHold - fragment.startDelay,
            )
            const localSeparation = clamp(
              (localPostHold - timing.impactDuration - timing.crackDuration) /
                timing.burstDuration,
              0,
              1,
            )
            localSettle = clamp(
              (localPostHold -
                timing.impactDuration -
                timing.crackDuration -
                timing.burstDuration) /
                timing.settleDuration,
              0,
              1,
            )
            localBreak = easeInOutCubic(localSeparation)
          }
          if (replayScar > 0) localBreak = Math.max(localBreak, 0.035)
          const localMotionFactor =
            clamp(localBreak + current.fragmentBias, 0, 1.25) *
            timing.motionScale *
            (useVoiceTimeline ? voiceDistanceScale : 1)
          const restoredActive =
            fragment.restoreRank < clamp(restorationEnergy * 0.64, 0, 0.5)
          const restorePull = restoredActive
            ? clamp(0.28 + restorationEnergy * 1.5, 0, 0.94)
            : 0
          const voiceDriftFade = useVoiceTimeline ? 1 - localSettle : 1
          const suspend =
            localSettle > 0
              ? Math.sin(time * 0.38 + fragment.phase) *
                fragment.drift *
                (current.reducedMotion ? 0.12 : 0.72) *
                voiceDriftFade
              : 0
          const lift =
            localSettle > 0
              ? Math.cos(time * 0.31 + fragment.phase * 1.4) *
                fragment.drift *
                (current.reducedMotion ? 0.1 : 0.5) *
                voiceDriftFade
              : 0
          const onsetKick =
            onsetBoost *
            (0.01 + (fragment.depth + 1) * 0.008) *
            (useVoiceTimeline ? 1 - (fractureProgress ?? 0) : 1)
          const localMotion =
            (localMotionFactor + onsetKick) *
            (1 - restorePull * 0.92)
          const dx = (fragment.motionX * localMotion + suspend) * (1 - restorePull)
          const dy = (fragment.motionY * localMotion + lift) * (1 - restorePull)
          const rotation =
            fragment.rotation * localMotion * (1 - restorePull * 0.9) +
            (localSettle > 0 && !restoredActive
              ? Math.sin(time * 0.26 + fragment.phase) *
                0.006 *
                voiceDriftFade
              : 0)
          const scale =
            fragment.scale * (1 + localMotion * (fragment.depth + 1) * 0.006)
          const opacity =
            fragment.opacity *
            (1 - localSettle * 0.035) *
            (0.9 + (fragment.depth + 1) * 0.04)
          const sprite = restoredActive
            ? current.restorationSource === 'voice'
              ? ensureRestoredSprite(geometry, fragment, 'voice')
              : current.restorationSource === 'rhythm'
                ? ensureRestoredSprite(geometry, fragment, 'rhythm')
                : fragment.sprite
            : fragment.sprite

          context.save()
          context.globalAlpha = clamp(opacity * fragmentReveal, 0, 0.96)
          context.translate(
            fragment.centroid.x + dx,
            fragment.centroid.y + dy,
          )
          context.rotate(rotation)
          context.scale(scale, scale)
          context.drawImage(
            sprite,
            fragment.drawX,
            fragment.drawY,
            fragment.width,
            fragment.height,
          )
          context.restore()
        }
      }

      const alignedCrackFade = 1 - separation * 0.8
      if (showFragments && alignedCrackFade > 0.02) {
        const crackAlphas = [
          clamp(crackProgress / 0.12, 0, 1),
          clamp((crackProgress - 0.32) / 0.3, 0, 1),
          clamp((crackProgress - 0.62) / 0.38, 0, 1),
        ]
        for (let index = 0; index < crackLayers.length; index += 1) {
          const alpha = crackAlphas[index] ?? 0
          if (alpha <= 0 || crackVisibility <= 0.01) continue
          context.globalAlpha =
            alpha *
            0.52 *
            crackVisibility *
            alignedCrackFade *
            (0.94 + voice * 0.04 + onsetBoost * 0.08)
          context.drawImage(crackLayers[index], 0, 0, width, height)
        }
      }
      context.globalAlpha = 1
    }

    const loop = () => {
      if (document.hidden) {
        animationFrame = 0
        return
      }
      const snapshot = propsRef.current.getVoicePlayback?.()
      const clockPaused =
        propsRef.current.fractureMode === 'voice' &&
        snapshot?.paused &&
        (snapshot.kind === 'main' || snapshot.kind === 'supplement')
      const restorationActive =
        propsRef.current.restoration > 0.01 || propsRef.current.restored
      if (!clockPaused || restorationActive) draw()
      animationFrame = requestAnimationFrame(loop)
    }
    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAt = performance.now()
        return
      }
      if (hiddenAt > 0) {
        const hiddenDuration = performance.now() - hiddenAt
        pulseRef.current += hiddenDuration
        if (fractureStartRef.current > 0) {
          fractureStartRef.current += hiddenDuration
        }
        if (recombineRef.current) {
          recombineRef.current.start += hiddenDuration
        }
        if (lastOnsetAtRef.current > 0) {
          lastOnsetAtRef.current += hiddenDuration
        }
        if (onsetBoostRef.current > 0) {
          onsetBoostRef.current += hiddenDuration
        }
        onsetSamplesRef.current = onsetSamplesRef.current.map((sample) => ({
          ...sample,
          at: sample.at + hiddenDuration,
        }))
        hiddenAt = 0
      }
      if (animationFrame === 0) loop()
    }

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(resize)
    })

    resize()
    observer.observe(canvas)
    document.addEventListener('visibilitychange', handleVisibility)
    loop()

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      cancelAnimationFrame(animationFrame)
      cancelAnimationFrame(resizeFrame)
      if (restoredBuildHandle !== null) cancelIdleWork(restoredBuildHandle)
      if (nextPrewarmHandle !== null) cancelIdleWork(nextPrewarmHandle)
      geometry = null
    }
  }, [chapter, debugBreakDuration, layoutMode, nextText, reducedMotion, text])

  const pauseDebugTimeline = () => {
    if (propsRef.current.fractureMode === 'voice') {
      setDebugTime(
        Math.round(
          (debugElapsedRef.current / Math.max(1, debugBreakDuration)) * 100,
        ),
      )
    } else {
      setDebugTime(Math.round(debugElapsedRef.current))
    }
    setDebugFreeze(true)
  }

  const resumeDebugTimeline = () => {
    if (propsRef.current.fractureMode === 'timed') {
      pulseRef.current =
        performance.now() - (readingHoldRef.current + debugTime)
    }
    setDebugFreeze(false)
  }

  const selectDebugTime = (value: number) => {
    setDebugTime(value)
    setDebugFreeze(true)
  }

  return (
    <div className="sound-field">
      <canvas
        ref={canvasRef}
        className="sound-field__canvas"
        role="img"
        aria-label={`${labelPrefix}：${text}`}
      />
      <span className="sr-only" aria-live="polite">
        {text}
      </span>
      {onTermClick && (
        <button
          type="button"
          className={`sound-field__term-hitarea ${
            guideActive ? 'is-guided' : ''
          }`}
          style={{
            left: hitArea.left,
            top: hitArea.top,
            width: hitArea.width,
            height: hitArea.height,
          }}
          aria-label={`查看“${text}”在生活里的意思`}
          onClick={onTermClick}
        >
          <span aria-hidden="true">看这句话的意思</span>
        </button>
      )}
      {import.meta.env.DEV && (
        <details className="glass-debug-panel" aria-label="玻璃破碎时间轴检查">
          <summary>时间轴检查</summary>
          <div className="glass-debug-panel__body">
            <div className="glass-debug-panel__header">
              <strong>破碎进度</strong>
              <button type="button" onClick={debugFreeze ? resumeDebugTimeline : pauseDebugTimeline}>
                {debugFreeze ? '从此刻继续' : '暂停在此刻'}
              </button>
            </div>
            <input
              type="range"
              min="0"
              max={debugScrubMax}
              step={fractureMode === 'voice' ? 1 : 10}
              value={debugTime}
              onChange={(event) => selectDebugTime(Number(event.target.value))}
              aria-label="玻璃破碎时间进度"
            />
            <div className="glass-debug-panel__marks">
              {debugMarks.map((value) => (
                <button key={value} type="button" onClick={() => selectDebugTime(value)}>
                  {fractureMode === 'voice' ? `${value}%` : `${value}ms`}
                </button>
              ))}
            </div>
            <p>
              {fractureMode === 'voice'
                ? '破碎进度：0% 完整 · 25% 裂纹 · 50% 断裂 · 75% 分离 · 100% 悬停'
                : '0ms 完整字形 · 200ms 裂纹 · 400ms 分离 · 600ms 弹开 · 800ms 悬停'}
            </p>
          </div>
        </details>
      )}
    </div>
  )
}