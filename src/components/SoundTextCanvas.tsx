import { useEffect, useRef } from 'react'
import type { StoryScene } from '../types'

type GlassChapter = StoryScene | 'transition' | 'ending'
type FractureMode = 'voice' | 'timed'

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

interface GlassFragment {
  polygon: Point[]
  centroid: Point
  bounds: FragmentBounds
  depth: number
  motionX: number
  motionY: number
  rotation: number
  phase: number
  restoreRank: number
  opacity: number
  scale: number
  drift: number
  drawX: number
  drawY: number
  width: number
  height: number
  sprite: HTMLCanvasElement
  restoredSprite: HTMLCanvasElement
}

interface GlassGeometry {
  width: number
  height: number
  dpr: number
  chars: CharCell[]
  fragments: GlassFragment[]
  glyphSurface: HTMLCanvasElement
  crackLayers: HTMLCanvasElement[]
  impacts: Point[]
}

const bodyFont =
  '"Source Han Serif SC", "Noto Serif SC", "Songti SC", STSong, SimSun, serif'

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const easeOutCubic = (value: number) => 1 - (1 - value) ** 3

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

function makeCharLayout(width: number, height: number, text: string): CharCell[] {
  const chars = Array.from(text.replace(/\s+/g, ''))
  const vertical = width < 660
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
      58,
      104,
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

function clipPolygonToBisector(polygon: Point[], seed: Point, other: Point) {
  const dx = other.x - seed.x
  const dy = other.y - seed.y
  const midpointX = (seed.x + other.x) / 2
  const midpointY = (seed.y + other.y) / 2
  const side = (point: Point) =>
    (point.x - midpointX) * dx + (point.y - midpointY) * dy

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
) {
  const surface = createSurface(width, height, dpr)
  const context = surface.getContext('2d')
  if (!context) return surface
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#A84432'
  for (const char of chars) {
    context.font = `${char.weight} ${char.size}px ${bodyFont}`
    context.fillText(char.char, char.x, char.y)
  }
  return surface
}

function makeFragmentSprite(
  glyphSurface: HTMLCanvasElement,
  bounds: FragmentBounds,
  polygon: Point[],
  dpr: number,
  restored: boolean,
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

  if (restored) {
    context.globalCompositeOperation = 'source-in'
    context.fillStyle = 'rgba(242, 242, 234, 0.93)'
    context.fillRect(bounds.left, bounds.top, bounds.width, bounds.height)
  }

  context.globalCompositeOperation = 'source-atop'
  context.strokeStyle = restored
    ? 'rgba(255, 255, 250, 0.76)'
    : 'rgba(239, 228, 210, 0.4)'
  context.lineWidth = restored ? 0.9 : 0.7
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

  const radialCracks: Array<{ points: Point[]; layerIndex: number }> = []
  const branchCountPerImpact = width < 660 ? 5 : 8
  for (const impact of impacts) {
    for (let branch = 0; branch < branchCountPerImpact; branch += 1) {
      const points: Point[] = [{ x: impact.x, y: impact.y }]
      let angle = rng() * Math.PI * 2
      let x = impact.x + Math.cos(angle) * 2.5
      let y = impact.y + Math.sin(angle) * 2.5
      const branchLength =
        18 + rng() * Math.min(width, height) * (0.18 + rng() * 0.14)
      const steps = 4 + Math.floor(rng() * 3)
      for (let step = 0; step < steps; step += 1) {
        angle += (rng() * 2 - 1) * 0.42
        const stepLength = (branchLength / steps) * (0.72 + rng() * 0.56)
        x += Math.cos(angle) * stepLength
        y += Math.sin(angle) * stepLength
        points.push({ x, y })
      }
      radialCracks.push({
        points,
        layerIndex: branch < 2 ? 0 : branch < 4 ? 1 : 2,
      })
    }
  }

  return layers.map((layer, layerIndex) => {
    const surface = createSurface(width, height, dpr)
    const context = surface.getContext('2d')
    if (!context) return surface
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.lineCap = 'round'
    context.lineJoin = 'round'

    for (const edge of layer) {
      const dx = edge.end.x - edge.start.x
      const dy = edge.end.y - edge.start.y
      const length = Math.max(1, Math.hypot(dx, dy))
      const normalX = -dy / length
      const normalY = dx / length
      const steps = 4
      const jitterRange = layerIndex === 0 ? 0.45 : 0.75

      context.beginPath()
      context.moveTo(edge.start.x, edge.start.y)
      for (let step = 1; step < steps; step += 1) {
        const ratio = step / steps
        const jitter = (rng() * 2 - 1) * jitterRange
        context.lineTo(
          edge.start.x + dx * ratio + normalX * jitter,
          edge.start.y + dy * ratio + normalY * jitter,
        )
      }
      context.lineTo(edge.end.x, edge.end.y)
      context.strokeStyle =
        rng() > 0.72
          ? 'rgba(168, 68, 50, 0.68)'
          : 'rgba(246, 240, 228, 0.82)'
      context.lineWidth = 0.8 + rng() * 0.55
      context.stroke()

      if (rng() > 0.72) {
        const ratio = 0.45 + rng() * 0.2
        const branchStart = {
          x: edge.start.x + dx * ratio,
          y: edge.start.y + dy * ratio,
        }
        const angle =
          Math.atan2(dy, dx) + (rng() > 0.5 ? 1 : -1) * (0.5 + rng() * 0.5)
        const branchLength = 4 + rng() * 10
        context.beginPath()
        context.moveTo(branchStart.x, branchStart.y)
        context.lineTo(
          branchStart.x + Math.cos(angle) * branchLength * 0.55,
          branchStart.y + Math.sin(angle) * branchLength * 0.55,
        )
        context.lineTo(
          branchStart.x + Math.cos(angle + 0.2) * branchLength,
          branchStart.y + Math.sin(angle + 0.2) * branchLength,
        )
        context.strokeStyle = 'rgba(234, 226, 211, 0.56)'
        context.lineWidth = 0.58
        context.stroke()
      }
    }

    for (const crack of radialCracks) {
      if (crack.layerIndex !== layerIndex) continue
      context.beginPath()
      context.moveTo(crack.points[0].x, crack.points[0].y)
      for (let index = 1; index < crack.points.length; index += 1) {
        context.lineTo(crack.points[index].x, crack.points[index].y)
      }
      context.strokeStyle =
        rng() > 0.76
          ? 'rgba(190, 102, 81, 0.74)'
          : 'rgba(250, 245, 232, 0.86)'
      context.lineWidth = 0.82 + rng() * 0.52
      context.stroke()
    }

    context.setTransform(1, 0, 0, 1, 0, 0)
    context.globalCompositeOperation = 'destination-in'
    context.drawImage(glyphSurface, 0, 0)
    context.globalCompositeOperation = 'source-over'
    return surface
  })
}
function buildGeometry(
  width: number,
  height: number,
  text: string,
  chapter: GlassChapter,
  reducedMotion: boolean,
): GlassGeometry | null {
  if (width < 2 || height < 2 || !text) return null
  const dpr = Math.min(window.devicePixelRatio || 1, 1.8)
  const chars = makeCharLayout(width, height, text)
  if (chars.length === 0) return null

  const textBounds = getTextBounds(chars, width, height)
  const glyphSurface = drawGlyphSurface(width, height, dpr, chars)
  const seed = hashString(`${text}|${chapter}|glass-v2`)
  const rng = mulberry32(seed)
  const chapterFactor =
    chapter === 'call'
      ? 0.8
      : chapter === 'stove'
        ? 1
        : chapter === 'cooling'
          ? 1.18
          : 1.05
  const targetBase = (width < 660 ? 3 : 5.1) * chars.length * chapterFactor
  const targetMax = width < 660 ? 24 : 48
  const targetMin = width < 660 ? 12 : 24
  const targetCount = clamp(
    Math.round(targetBase * (reducedMotion ? 0.62 : 1)),
    Math.round(targetMin * (reducedMotion ? 0.67 : 1)),
    Math.round(targetMax * (reducedMotion ? 0.7 : 1)),
  )

  const seeds: Point[] = []
  for (let index = 0; index < targetCount; index += 1) {
    const char = chars[index % chars.length]
    const spread = index % 7 === 0 ? 0.92 : 0.58
    seeds.push({
      x: char.x + (rng() * 2 - 1) * char.size * spread,
      y: char.y + (rng() * 2 - 1) * char.size * spread,
    })
  }

  const baseRectangle: Point[] = [
    { x: textBounds.left, y: textBounds.top },
    { x: textBounds.right, y: textBounds.top },
    { x: textBounds.right, y: textBounds.bottom },
    { x: textBounds.left, y: textBounds.bottom },
  ]

  const fragments: GlassFragment[] = []
  for (let index = 0; index < seeds.length; index += 1) {
    const seedPoint = seeds[index]
    let polygon = baseRectangle
    for (let otherIndex = 0; otherIndex < seeds.length; otherIndex += 1) {
      if (otherIndex === index) continue
      polygon = clipPolygonToBisector(polygon, seedPoint, seeds[otherIndex])
      if (polygon.length < 3) break
    }
    if (polygon.length < 3 || polygonArea(polygon) < 2.2) continue

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

    const depth = rng() * 2 - 1
    const kind = rng()
    let motionX = 0
    let motionY = 0
    if (kind > 0.28) {
      if (kind > 0.82) {
        motionX = (rng() * 2 - 1) * 14
        motionY = 10 + rng() * 30
      } else {
        const angle = rng() * Math.PI * 2
        const distance = 4 + rng() * 19
        motionX = Math.cos(angle) * distance
        motionY = Math.sin(angle) * distance
      }
    } else {
      motionX = (rng() * 2 - 1) * 3
      motionY = (rng() * 2 - 1) * 2.5
    }

    if (chapter === 'stove') motionY += 4 + rng() * 7
    if (chapter === 'cooling') {
      motionX *= 1.12
      motionY *= 1.12
    }

    const baseSprite = makeFragmentSprite(
      glyphSurface,
      bounds,
      polygon,
      dpr,
      false,
    )
    const restoredSprite = makeFragmentSprite(
      glyphSurface,
      bounds,
      polygon,
      dpr,
      true,
    )
    fragments.push({
      polygon,
      centroid,
      bounds,
      depth,
      motionX,
      motionY,
      rotation: (rng() * 2 - 1) * (width < 660 ? 0.11 : 0.17),
      phase: rng() * Math.PI * 2,
      restoreRank: rng(),
      opacity: 0.64 + rng() * 0.28,
      scale: 1 + depth * 0.025,
      drift: 0.35 + rng() * 1.05,
      drawX: bounds.left - centroid.x,
      drawY: bounds.top - centroid.y,
      width: bounds.width,
      height: bounds.height,
      sprite: baseSprite,
      restoredSprite,
    })
  }

  if (fragments.length === 0) return null
  fragments.sort((a, b) => a.depth - b.depth)

  const impacts: Point[] = []
  const impactCount = rng() > 0.72 ? 2 : 1
  for (let index = 0; index < impactCount; index += 1) {
    const char = chars[Math.floor(rng() * chars.length)]
    impacts.push({
      x: char.x + (rng() * 2 - 1) * char.size * 0.35,
      y: char.y + (rng() * 2 - 1) * char.size * 0.4,
    })
  }

  const crackLayers = makeCrackLayers(
    glyphSurface,
    width,
    height,
    dpr,
    fragments,
    impacts,
    seed,
  )

  return {
    width,
    height,
    dpr,
    chars,
    fragments,
    glyphSurface,
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
  labelPrefix = '声音文字场',
}: SoundTextCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
  })
  const pulseRef = useRef(0)
  const fractureStartRef = useRef(0)
  const wasSpeakingRef = useRef(speaking)

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
  ])

  useEffect(() => {
    pulseRef.current = performance.now()
    fractureStartRef.current = 0
    wasSpeakingRef.current = propsRef.current.speaking
  }, [stateKey, replayToken])

  useEffect(() => {
    if (speaking) {
      fractureStartRef.current = 0
      wasSpeakingRef.current = true
    } else if (wasSpeakingRef.current) {
      fractureStartRef.current = performance.now()
      wasSpeakingRef.current = false
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

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 1.8)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      geometry = buildGeometry(
        rect.width,
        rect.height,
        text,
        chapter,
        reducedMotion,
      )
    }

    const draw = () => {
      if (!geometry) return
      const current = propsRef.current
      const { width, height, chars, fragments, glyphSurface, crackLayers, impacts } =
        geometry
      context.clearRect(0, 0, width, height)

      const now = performance.now()
      const time = now / 1000
      const sincePulse = (now - pulseRef.current) / 1000
      const voice = clamp(current.audioLevel * 1.6, 0, 1)
      const speaking = current.speaking && current.fractureMode === 'voice'
      const preStress = speaking
        ? clamp((sincePulse - 1.05) / 5.2, 0, 0.25) + voice * 0.1
        : 0

      let fractureElapsed = 0
      if (current.fractureMode === 'timed') {
        fractureElapsed = Math.max(0, now - pulseRef.current - 350)
      } else if (!current.speaking && fractureStartRef.current > 0) {
        fractureElapsed = Math.max(0, now - fractureStartRef.current)
      } else if (!current.speaking && sincePulse > 2.6) {
        fractureElapsed = Math.max(0, (sincePulse - 2.6) * 1000)
      }

      const crackDuration = 520 * (1.15 - voice * 0.22)
      const crackProgress = clamp(
        Math.max(preStress, fractureElapsed / crackDuration),
        0,
        1,
      )
      const separation = speaking ? 0 : clamp((fractureElapsed - 500) / 400, 0, 1)
      const settle = speaking ? 0 : clamp((fractureElapsed - 900) / 900, 0, 1)
      const shatter =
        easeOutCubic(separation) * (0.55 + easeOutCubic(settle) * 0.45)
      const motionFactor =
        clamp(shatter + current.fragmentBias, 0, 1.25) *
        (current.reducedMotion ? 0.32 : 1)
      const restorationEnergy = clamp(
        current.restoration * 0.78 + (current.restored ? 0.1 : 0),
        0,
        0.88,
      )
      const showFragments =
        separation > 0.012 || motionFactor > 0.02 || restorationEnergy > 0.05
      const stressJitter =
        crackProgress * (0.5 + voice * 1.8) * (current.reducedMotion ? 0.25 : 1)

      if (!showFragments) {
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillStyle = '#A84432'
        context.globalAlpha = 0.92
        for (const char of chars) {
          const jitterX =
            Math.sin(time * 1.15 + char.x * 0.025) * stressJitter
          const jitterY =
            Math.cos(time * 1.32 + char.y * 0.03) * stressJitter * 0.55
          context.font = `${char.weight} ${char.size}px ${bodyFont}`
          context.fillText(char.char, char.x + jitterX, char.y + jitterY)
        }
        context.globalAlpha = 1
      } else {
        // Keep a faint but readable silhouette as the memory anchor.
        context.globalAlpha = clamp(0.14 + restorationEnergy * 0.06, 0.13, 0.2)
        context.drawImage(glyphSurface, 0, 0, width, height)
        context.globalAlpha = clamp(
          (width < 660 ? 0.3 : 0.24) + restorationEnergy * 0.1,
          width < 660 ? 0.27 : 0.22,
          0.36,
        )
        context.strokeStyle = 'rgba(242, 242, 234, 0.62)'
        context.lineWidth = 0.55
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        for (const char of chars) {
          context.font = `${char.weight} ${char.size}px ${bodyFont}`
          context.strokeText(char.char, char.x, char.y)
        }
        context.globalAlpha = 1
      }

      const crackAlphas = [
        clamp(crackProgress / 0.12, 0, 1),
        clamp((crackProgress - 0.32) / 0.3, 0, 1),
        clamp((crackProgress - 0.62) / 0.38, 0, 1),
      ]
      for (let index = 0; index < crackLayers.length; index += 1) {
        const alpha = crackAlphas[index] ?? 0
        if (alpha <= 0) continue
        context.globalAlpha = alpha * 0.95
        context.drawImage(crackLayers[index], 0, 0, width, height)
      }
      context.globalAlpha = 1

      if (!speaking && fractureElapsed < 190) {
        const flash = 1 - fractureElapsed / 190
        for (const impact of impacts) {
          const gradient = context.createRadialGradient(
            impact.x,
            impact.y,
            0,
            impact.x,
            impact.y,
            24 + flash * 16,
          )
          gradient.addColorStop(0, `rgba(250, 243, 228, ${0.24 * flash})`)
          gradient.addColorStop(0.24, `rgba(168, 68, 50, ${0.14 * flash})`)
          gradient.addColorStop(1, 'rgba(168, 68, 50, 0)')
          context.fillStyle = gradient
          context.fillRect(
            impact.x - 42,
            impact.y - 42,
            84,
            84,
          )
        }
      }

      if (showFragments) {
        const chapterMotion =
          current.chapter === 'call'
            ? 0.62
            : current.chapter === 'stove'
              ? 0.84
              : current.chapter === 'cooling'
                ? 1.16
                : current.chapter === 'ending'
                  ? 1
                  : 0.92

        for (const fragment of fragments) {
          const restoredActive = fragment.restoreRank < restorationEnergy
          const restorePull = restoredActive
            ? clamp(restorationEnergy * 1.16, 0, 1)
            : clamp(restorationEnergy * 0.14, 0, 0.2)
          const suspend =
            settle > 0
              ? Math.sin(time * 0.38 + fragment.phase) *
                fragment.drift *
                (current.reducedMotion ? 0.2 : 1.2)
              : 0
          const lift =
            settle > 0
              ? Math.cos(time * 0.31 + fragment.phase * 1.4) *
                fragment.drift *
                (current.reducedMotion ? 0.18 : 0.85)
              : 0
          const localMotion =
            motionFactor *
            chapterMotion *
            (1 - restorePull * 0.92) *
            (0.92 + voice * 0.13)
          const dx = (fragment.motionX * localMotion + suspend) * (1 - restorePull)
          const dy = (fragment.motionY * localMotion + lift) * (1 - restorePull)
          const rotation =
            fragment.rotation * localMotion * (1 - restorePull * 0.9) +
            (settle > 0 && !restoredActive
              ? Math.sin(time * 0.26 + fragment.phase) * 0.012
              : 0)
          const scale =
            fragment.scale * (1 + localMotion * (fragment.depth + 1) * 0.012)
          const opacity =
            fragment.opacity *
            (1 - settle * 0.08) *
            (0.88 + (fragment.depth + 1) * 0.06) *
            (restoredActive ? 1 : 1 - restorationEnergy * 0.18)
          const sprite = restoredActive
            ? fragment.restoredSprite
            : fragment.sprite

          context.save()
          context.globalAlpha = clamp(opacity, 0.28, 0.96)
          if (
            width >= 660 &&
            !current.reducedMotion &&
            settle > 0.35 &&
            fragment.depth < -0.45
          ) {
            context.filter = `blur(${0.28 + Math.abs(fragment.depth) * 0.45}px)`
          }
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
      context.filter = 'none'
      context.globalAlpha = 1
    }

    const loop = () => {
      if (document.hidden) {
        animationFrame = 0
        return
      }
      draw()
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
      geometry = null
    }
  }, [chapter, reducedMotion, text])

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
    </div>
  )
}